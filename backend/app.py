from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Dict, Optional

import bcrypt
from flask import Flask, Response, make_response, request, g, session
from flask_cors import CORS
from pymongo import errors as pymongo_errors
from pydantic import ValidationError

from .config import settings
from .models import (
    APIResponse,
    BusinessErrorCode,
    Spec,
    UploadPayload,
    UpdatePayload,
    User,
    UserCredentials,
    spec_to_document,
)
from .mongo import (
    create_user_document,
    delete_spec_document,
    find_user_document_by_id,
    find_user_document_by_username,
    save_spec_document,
    update_user_timestamp,
)
from .repository import repository
from .utils import derive_short_id, generate_short_id


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = settings.session_secret
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    CORS(
        app,
        resources={r"/*": {"origins": settings.cors_origins}},
        supports_credentials=True,
    )

    logging.basicConfig(level=logging.INFO)

    @app.before_request
    def assign_trace_id() -> None:
        g.trace_id = f"req-{uuid.uuid4()}"
        g.current_user = None

    @app.before_request
    def load_current_user() -> None:
        user_id = session.get("user_id")
        if not user_id:
            return
        document = find_user_document_by_id(user_id)
        if not document:
            session.pop("user_id", None)
            return
        g.current_user = User(
            id=str(document.get("_id") or document.get("id")),
            username=document.get("username", ""),
            createdAt=document.get("createdAt"),
            updatedAt=document.get("updatedAt"),
        )

    @app.after_request
    def add_trace_header(response: Response) -> Response:
        response.headers["X-Trace-Id"] = g.get("trace_id", "")
        return response

    def _json_default(value: Any) -> Any:
        if isinstance(value, datetime):
            dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
            iso = dt.astimezone(timezone.utc).isoformat()
            return iso.replace("+00:00", "Z")
        if isinstance(value, set):
            return list(value)
        return str(value)

    def response_payload(data: Optional[Dict[str, Any]] = None, status: int = 200) -> Response:
        payload = APIResponse.success(data=data).dict()
        response = make_response(json.dumps(payload, default=_json_default), status)
        response.headers["Content-Type"] = "application/json"
        return response

    def handle_error(
        code: BusinessErrorCode,
        message: Optional[str] = None,
        status: int = 400,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> Response:
        error_data: Dict[str, Any] = {"traceId": g.get("trace_id", "")}
        if extra_data:
            error_data.update(extra_data)
        payload = APIResponse.from_error(code, message=message, data=error_data).dict()
        response = make_response(json.dumps(payload), status)
        response.headers["Content-Type"] = "application/json"
        return response

    def require_login(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            if g.get("current_user") is None:
                return handle_error(BusinessErrorCode.UNAUTHORIZED, "Login required", 401)
            return func(*args, **kwargs)

        return wrapper

    def sanitize_user_response(user: User | None) -> Dict[str, Any]:
        if not user:
            return {"user": None}
        return {"user": user.dict(by_alias=True)}

    def spec_owned_by_user(spec: Spec, user: User) -> bool:
        if spec.ownerId:
            return spec.ownerId == user.id
        normalized_author = (spec.author or "").lstrip("@")
        return normalized_author == user.username

    @app.route("/specmarket/v1/auth/register", methods=["POST"])
    def register_user():
        payload_json = request.get_json(silent=True) or {}
        try:
            credentials = UserCredentials(**payload_json)
        except ValidationError as exc:
            message = "; ".join(error["msg"] for error in exc.errors())
            return handle_error(BusinessErrorCode.INVALID_ARG, message or "Invalid payload", 400)
        password_hash = bcrypt.hashpw(credentials.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        try:
            document = create_user_document(credentials.username, password_hash)
        except pymongo_errors.DuplicateKeyError:
            return handle_error(BusinessErrorCode.INVALID_ARG, "Username already exists", 400)
        session["user_id"] = document["_id"]
        session.permanent = True
        user = User(
            id=document["_id"],
            username=document["username"],
            createdAt=document["createdAt"],
            updatedAt=document["updatedAt"],
        )
        return response_payload(sanitize_user_response(user), 201)

    @app.route("/specmarket/v1/auth/login", methods=["POST"])
    def login_user():
        payload_json = request.get_json(silent=True) or {}
        try:
            credentials = UserCredentials(**payload_json)
        except ValidationError as exc:
            message = "; ".join(error["msg"] for error in exc.errors())
            return handle_error(BusinessErrorCode.INVALID_ARG, message or "Invalid payload", 400)
        document = find_user_document_by_username(credentials.username)
        password_hash = document.get("passwordHash") if document else None
        if not password_hash or not bcrypt.checkpw(credentials.password.encode("utf-8"), password_hash.encode("utf-8")):
            return handle_error(BusinessErrorCode.UNAUTHORIZED, "Invalid username or password", 401)
        session["user_id"] = document["_id"]
        session.permanent = True
        update_user_timestamp(document["_id"])
        refreshed = find_user_document_by_id(document["_id"])
        if refreshed:
            document = refreshed
        user = User(
            id=document["_id"],
            username=document["username"],
            createdAt=document["createdAt"],
            updatedAt=document["updatedAt"],
        )
        return response_payload(sanitize_user_response(user), 200)

    @app.route("/specmarket/v1/auth/logout", methods=["POST"])
    def logout_user():
        session.pop("user_id", None)
        g.current_user = None
        return response_payload({}, 200)

    @app.route("/specmarket/v1/auth/me")
    def current_user():
        user = g.get("current_user")
        return response_payload(sanitize_user_response(user), 200)

    @app.route("/specmarket/v1/listSpecs")
    def list_specs():
        page = int(request.args.get("page", 1))
        page_size = min(int(request.args.get("pageSize", 10)), 50)
        tag = request.args.get("tag")
        category = request.args.get("category")
        order = request.args.get("order", "-updatedAt")
        search = request.args.get("q")
        filter_key = request.args.get("filter")
        updated_since_param = request.args.get("updatedSince")
        updated_since = None
        if updated_since_param:
            try:
                updated_since = datetime.fromisoformat(updated_since_param)
            except ValueError:
                return handle_error(
                    BusinessErrorCode.INVALID_ARG,
                    "updatedSince must be ISO format",
                    400,
                )
        elif filter_key == "today":
            now = datetime.now(timezone.utc)
            updated_since = now.replace(hour=0, minute=0, second=0, microsecond=0)
        paginated = repository.list_specs(
            page=page,
            page_size=page_size,
            tag=tag,
            category=category,
            order=order,
            search=search,
            updated_since=updated_since,
        )
        return response_payload(json.loads(paginated.json()))

    @app.route("/specmarket/v1/getSpecDetail")
    def get_spec_detail():
        short_id = request.args.get("shortId")
        if not short_id:
            return handle_error(BusinessErrorCode.INVALID_ARG, "shortId is required", 400)
        spec = repository.get_spec(short_id)
        if not spec:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        spec_dict = spec.dict(by_alias=True)
        return response_payload(spec_dict)

    @app.route("/specmarket/v1/deleteSpec", methods=["DELETE"])
    @require_login
    def delete_spec():
        payload = request.get_json(silent=True)
        short_id = None
        if isinstance(payload, dict):
            short_id = payload.get("shortId")
        if not short_id or not isinstance(short_id, str):
            return handle_error(BusinessErrorCode.INVALID_ARG, "shortId is required", 400)

        spec = repository.get_spec(short_id)
        if not spec:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        user: User | None = g.get("current_user")
        if user is None:
            return handle_error(BusinessErrorCode.UNAUTHORIZED, "Login required", 401)
        if not spec_owned_by_user(spec, user):
            return handle_error(
                BusinessErrorCode.UNAUTHORIZED,
                "You do not have permission to modify this spec",
                403,
            )

        removed = repository.delete_spec(short_id)
        if not removed:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)

        try:
            delete_spec_document(short_id)
        except pymongo_errors.PyMongoError as exc:
            logging.warning("Failed to delete spec from MongoDB: %s", exc)

        return response_payload({"shortId": short_id})

    @app.route("/specmarket/v1/getSpecRaw")
    def get_spec_raw():
        short_id = request.args.get("shortId")
        if not short_id:
            return handle_error(BusinessErrorCode.INVALID_ARG, "shortId is required", 400)
        spec = repository.get_spec(short_id)
        if not spec:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        response = make_response(spec.contentMd, 200)
        response.headers["Content-Type"] = "text/plain; charset=utf-8"
        return response

    @app.route("/specmarket/v1/downloadSpec")
    def download_spec():
        short_id = request.args.get("shortId")
        if not short_id:
            return handle_error(BusinessErrorCode.INVALID_ARG, "shortId is required", 400)
        spec = repository.get_spec(short_id)
        if not spec:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        response = make_response(spec.contentMd)
        response.headers["Content-Type"] = "text/markdown; charset=utf-8"
        response.headers["Content-Disposition"] = f"attachment; filename={short_id}.md"
        return response

    @app.route("/specmarket/v1/listCategories")
    def list_categories():
        categories = repository.list_categories()
        return response_payload({"items": json.loads(json.dumps([c.dict() for c in categories]))})

    @app.route("/specmarket/v1/listTags")
    def list_tags():
        tags = repository.list_tags()
        return response_payload({"items": json.loads(json.dumps([t.dict() for t in tags]))})

    @app.route("/specmarket/v1/getCategorySpecs")
    def get_category_specs():
        slug = request.args.get("slug")
        if not slug:
            return handle_error(BusinessErrorCode.INVALID_ARG, "slug is required", 400)
        category_specs = repository.list_specs(category=slug)
        return response_payload(json.loads(category_specs.json()))

    @app.route("/specmarket/v1/getTagSpecs")
    def get_tag_specs():
        slug = request.args.get("slug")
        if not slug:
            return handle_error(BusinessErrorCode.INVALID_ARG, "slug is required", 400)
        tag_specs = repository.list_specs(tag=slug)
        return response_payload(json.loads(tag_specs.json()))

    @app.route("/specmarket/v1/uploadSpec", methods=["POST"])
    @require_login
    def upload_spec():
        form = request.form
        user: User | None = g.get("current_user")
        if user is None:
            return handle_error(BusinessErrorCode.UNAUTHORIZED, "Login required", 401)
        file = request.files.get("file")
        content_md = form.get("content") or (file.read().decode("utf-8") if file else None)
        if not content_md:
            return handle_error(
                BusinessErrorCode.INVALID_ARG,
                "Markdown content is required",
                400,
            )
        tags_raw = form.get("tags", "")
        tags = [tag.strip() for tag in tags_raw.split(",") if tag.strip()]
        legacy_slug = (form.get("slug") or "").strip() or None
        short_id_candidate = (form.get("shortId") or "").strip() or None
        existing = None
        if short_id_candidate:
            existing = repository.get_spec(short_id_candidate)
        elif legacy_slug:
            derived_short_id = derive_short_id(legacy_slug)
            existing = repository.get_spec(derived_short_id)
            if existing:
                short_id_candidate = existing.shortId
        payload = UploadPayload(
            title=form.get("title", "Untitled"),
            category=form.get("category", "uncategorized"),
            summary=form.get("summary", ""),
            tags=tags,
            shortId=short_id_candidate,
        )
        now = datetime.now(timezone.utc)
        existing = existing or (repository.get_spec(payload.shortId) if payload.shortId else None)
        if existing and not spec_owned_by_user(existing, user):
            return handle_error(
                BusinessErrorCode.UNAUTHORIZED,
                "You do not have permission to modify this spec",
                403,
            )
        created_at = existing.createdAt if existing else now
        if existing:
            short_id = existing.shortId
        else:
            short_id = payload.shortId or generate_short_id()
            while repository.get_spec(short_id):
                short_id = generate_short_id()
        spec_id = existing.id if existing else f"spec-{short_id}"
        owner_id = existing.ownerId if existing and existing.ownerId else user.id
        author = f"@{user.username}"
        spec = Spec(
            id=spec_id,
            title=payload.title,
            shortId=short_id,
            summary=payload.summary,
            category=payload.category,
            tags=payload.tags,
            author=author,
            createdAt=created_at,
            contentMd=content_md,
            updatedAt=now,
            ownerId=owner_id,
        )
        document = spec_to_document(spec)
        try:
            save_spec_document(document)
            repository.refresh_from_document(document)
        except pymongo_errors.PyMongoError as exc:
            logging.exception("Failed to persist spec to MongoDB: %s", exc)
            return handle_error(
                BusinessErrorCode.INTERNAL,
                "Failed to persist spec",
                500,
            )
        return response_payload({"id": spec.id, "shortId": spec.shortId}, 201)

    @app.route("/specmarket/v1/updateSpec", methods=["PUT"])
    @require_login
    def update_spec():
        payload_json = request.get_json(silent=True)
        if not payload_json:
            return handle_error(
                BusinessErrorCode.INVALID_ARG,
                "JSON body with spec fields is required",
                400,
            )
        try:
            payload = UpdatePayload(**payload_json)
        except ValidationError as exc:
            message = "; ".join(error["msg"] for error in exc.errors())
            return handle_error(BusinessErrorCode.INVALID_ARG, message or "Invalid payload", 400)
        user: User | None = g.get("current_user")
        if user is None:
            return handle_error(BusinessErrorCode.UNAUTHORIZED, "Login required", 401)
        existing = repository.get_spec(payload.shortId)
        if not existing:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        if not spec_owned_by_user(existing, user):
            return handle_error(
                BusinessErrorCode.UNAUTHORIZED,
                "You do not have permission to modify this spec",
                403,
            )
        now = datetime.now(timezone.utc)
        content_md = payload.contentMd
        spec = Spec(
            id=existing.id,
            title=payload.title,
            shortId=existing.shortId,
            summary=payload.summary,
            category=payload.category,
            tags=payload.tags,
            author=f"@{user.username}",
            createdAt=existing.createdAt,
            contentMd=content_md,
            updatedAt=now,
            ownerId=existing.ownerId or user.id,
        )
        document = spec_to_document(spec)
        try:
            save_spec_document(document)
            repository.refresh_from_document(document)
        except pymongo_errors.PyMongoError as exc:
            logging.exception("Failed to persist spec update to MongoDB: %s", exc)
            return handle_error(
                BusinessErrorCode.INTERNAL,
                "Failed to persist spec",
                500,
            )
        return response_payload({"shortId": spec.shortId, "updatedAt": spec.updatedAt}, 200)

    @app.route("/healthz")
    def healthz():
        uptime_seconds = (datetime.now(timezone.utc) - datetime.fromtimestamp(app.start_time, tz=timezone.utc)).total_seconds()
        return response_payload({"ok": True, "mongo": False, "uptime": uptime_seconds})

    @app.errorhandler(404)
    def not_found(error):  # type: ignore[override]
        return handle_error(BusinessErrorCode.NOT_FOUND, "Route not found", 404)

    @app.errorhandler(Exception)
    def internal_error(error):  # type: ignore[override]
        logging.exception("Unhandled error: %s", error)
        return handle_error(BusinessErrorCode.INTERNAL, "Internal server error", 500)

    app.start_time = datetime.now(timezone.utc).timestamp()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=settings.port)
