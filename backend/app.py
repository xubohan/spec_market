from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Dict, Optional

from flask import Flask, Response, make_response, request, g
from flask_caching import Cache
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
    spec_to_document,
)
from .mongo import save_spec_document
from .repository import repository
from .utils import compute_etag, derive_short_id, generate_short_id, http_datetime


cache = Cache(config={"CACHE_TYPE": settings.cache_backend})


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": settings.cors_origins}})
    cache.init_app(app)

    logging.basicConfig(level=logging.INFO)

    @app.before_request
    def assign_trace_id() -> None:
        g.trace_id = f"req-{uuid.uuid4()}"

    @app.after_request
    def add_trace_header(response: Response) -> Response:
        response.headers["X-Trace-Id"] = g.get("trace_id", "")
        return response

    def response_payload(data: Optional[Dict[str, Any]] = None, status: int = 200) -> Response:
        payload = APIResponse.success(data=data).dict()
        response = make_response(json.dumps(payload, default=str), status)
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

    def require_admin_token(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            token = request.headers.get("X-Admin-Token")
            if token != settings.admin_token:
                return handle_error(BusinessErrorCode.UNAUTHORIZED, "Invalid admin token", 401)
            return func(*args, **kwargs)

        return wrapper

    def cache_key(*args, **kwargs):
        return request.full_path

    @app.route("/specmarket/v1/listSpecs")
    @cache.cached(timeout=60, key_prefix=cache_key)
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
    @cache.cached(timeout=60, key_prefix=cache_key)
    def get_spec_detail():
        short_id = request.args.get("shortId")
        if not short_id:
            return handle_error(BusinessErrorCode.INVALID_ARG, "shortId is required", 400)
        spec = repository.get_spec(short_id)
        if not spec:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        spec_dict = spec.dict(by_alias=True)
        etag = compute_etag(json.dumps(spec_dict, default=str).encode("utf-8"))
        last_modified = spec.updatedAt.astimezone(timezone.utc)
        if request.headers.get("If-None-Match") == etag:
            response = make_response("", 304)
        elif "If-Modified-Since" in request.headers and request.headers["If-Modified-Since"] == http_datetime(last_modified):
            response = make_response("", 304)
        else:
            response = response_payload(spec_dict)
        response.headers["ETag"] = etag
        response.headers["Last-Modified"] = http_datetime(last_modified)
        return response

    @app.route("/specmarket/v1/getSpecRaw")
    @cache.cached(timeout=60, key_prefix=cache_key)
    def get_spec_raw():
        short_id = request.args.get("shortId")
        if not short_id:
            return handle_error(BusinessErrorCode.INVALID_ARG, "shortId is required", 400)
        spec = repository.get_spec(short_id)
        if not spec:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        etag = compute_etag(spec.contentMd.encode("utf-8"))
        if request.headers.get("If-None-Match") == etag:
            response = make_response("", 304)
        else:
            response = make_response(spec.contentMd, 200)
        response.headers["Content-Type"] = "text/plain; charset=utf-8"
        response.headers["ETag"] = etag
        response.headers["Last-Modified"] = http_datetime(spec.updatedAt.astimezone(timezone.utc))
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
    @cache.cached(timeout=60, key_prefix=cache_key)
    def list_categories():
        categories = repository.list_categories()
        return response_payload({"items": json.loads(json.dumps([c.dict() for c in categories]))})

    @app.route("/specmarket/v1/listTags")
    @cache.cached(timeout=60, key_prefix=cache_key)
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
    @require_admin_token
    def upload_spec():
        form = request.form
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
        author = (form.get("author") or "").strip()
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
            author=author,
            shortId=short_id_candidate,
        )
        if not payload.author:
            return handle_error(BusinessErrorCode.INVALID_ARG, "author is required", 400)
        now = datetime.now(timezone.utc)
        existing = existing or (repository.get_spec(payload.shortId) if payload.shortId else None)
        created_at = existing.createdAt if existing else now
        if existing:
            short_id = existing.shortId
        else:
            short_id = payload.shortId or generate_short_id()
            while repository.get_spec(short_id):
                short_id = generate_short_id()
        spec_id = existing.id if existing else f"spec-{short_id}"
        spec = Spec(
            id=spec_id,
            title=payload.title,
            shortId=short_id,
            summary=payload.summary,
            category=payload.category,
            tags=payload.tags,
            author=payload.author,
            createdAt=created_at,
            contentMd=content_md,
            updatedAt=now,
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
    @require_admin_token
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
        existing = repository.get_spec(payload.shortId)
        if not existing:
            return handle_error(BusinessErrorCode.NOT_FOUND, "Spec not found", 404)
        now = datetime.now(timezone.utc)
        content_md = payload.contentMd
        spec = Spec(
            id=existing.id,
            title=payload.title,
            shortId=existing.shortId,
            summary=payload.summary,
            category=payload.category,
            tags=payload.tags,
            author=payload.author,
            createdAt=existing.createdAt,
            contentMd=content_md,
            updatedAt=now,
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
        cache.clear()
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
