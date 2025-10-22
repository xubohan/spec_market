from __future__ import annotations

import io
from datetime import datetime, timezone

from backend.models import BusinessErrorCode
from backend import mongo as mongo_module


TEST_USERNAME = "tester"
TEST_PASSWORD = "StrongPass1!"


def _register_user(client, username: str = TEST_USERNAME, password: str = TEST_PASSWORD):
    resp = client.post(
        "/specmarket/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 201
    return resp


def _login_user(client, username: str = TEST_USERNAME, password: str = TEST_PASSWORD):
    resp = client.post(
        "/specmarket/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200
    return resp


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _upload_spec(
    client,
    *,
    title: str,
    summary: str,
    category: str,
    tags: str,
    content: str,
    filename: str = "upload.md",
):
    payload = {
        "title": title,
        "summary": summary,
        "category": category,
        "tags": tags,
        "file": (io.BytesIO(content.encode("utf-8")), filename),
    }
    resp = client.post(
        "/specmarket/v1/uploadSpec",
        data=payload,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    return resp.get_json()["data"]["shortId"]


def test_register_and_me(client):
    resp = _register_user(client, "alice", "VerySecure1!")
    data = resp.get_json()["data"]["user"]
    assert data["username"] == "alice"

    me_resp = client.get("/specmarket/v1/auth/me")
    assert me_resp.status_code == 200
    me_data = me_resp.get_json()["data"]["user"]
    assert me_data["username"] == "alice"


def test_register_duplicate_username(client):
    _register_user(client, "dup", "Password123!")
    resp = client.post(
        "/specmarket/v1/auth/register",
        json={"username": "dup", "password": "Password123!"},
    )
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["status_code"] == BusinessErrorCode.INVALID_ARG


def test_login_and_logout_flow(client):
    _register_user(client, "bob", "Password123!")
    client.post("/specmarket/v1/auth/logout")

    login_resp = _login_user(client, "bob", "Password123!")
    user_data = login_resp.get_json()["data"]["user"]
    assert user_data["username"] == "bob"

    logout_resp = client.post("/specmarket/v1/auth/logout")
    assert logout_resp.status_code == 200
    me_after_logout = client.get("/specmarket/v1/auth/me")
    assert me_after_logout.get_json()["data"]["user"] is None


def test_login_invalid_credentials(client):
    _register_user(client, "carol", "Password123!")
    client.post("/specmarket/v1/auth/logout")
    resp = client.post(
        "/specmarket/v1/auth/login",
        json={"username": "carol", "password": "WrongPassword1"},
    )
    assert resp.status_code == 401
    assert resp.get_json()["status_code"] == BusinessErrorCode.UNAUTHORIZED


def test_list_specs(client):
    resp = client.get("/specmarket/v1/listSpecs")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    assert body["status_msg"] == "success"
    assert body["data"]["total"] == 1


def test_list_specs_filter_today_handles_naive_documents(client):
    from backend import repository as repository_module

    repo = repository_module.repository
    naive_created = datetime.now(timezone.utc).replace(tzinfo=None)
    naive_updated = datetime.now(timezone.utc).replace(tzinfo=None)
    metadata_doc = {
        "title": "Naive datetime spec",
        "shortId": "B7C8D9E0F1G2H3I4",
        "summary": "Summary",
        "category": "test",
        "tags": ["tag"],
        "author": "Demo Author",
        "createdAt": naive_created,
        "updatedAt": naive_updated,
        "version": 1,
    }
    version_doc = {**metadata_doc, "contentMd": "## Overview\nNaive content"}
    repo.refresh_from_document(metadata_doc, version_doc)

    resp = client.get("/specmarket/v1/listSpecs", query_string={"filter": "today"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["shortId"] == "B7C8D9E0F1G2H3I4"
    repo.specs.pop("B7C8D9E0F1G2H3I4", None)
    repo.metadata.pop("B7C8D9E0F1G2H3I4", None)


def test_get_spec_detail(client):
    resp = client.get("/specmarket/v1/getSpecDetail", query_string={"shortId": "A1B2C3D4E5F6G7H8"})
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["status_code"] == BusinessErrorCode.SUCCESS
    assert payload["status_msg"] == "success"
    data = payload["data"]
    assert data["shortId"] == "A1B2C3D4E5F6G7H8"
    assert "contentMd" in data
    assert "contentHtml" not in data
    assert data["version"] == 1
    assert data["isLatest"] is True
    history = data["history"]
    assert history["latestVersion"] == 1
    assert history["total"] == 1
    assert len(history["items"]) == 1
    assert history["items"][0]["version"] == 1


def test_get_spec_raw(client):
    resp = client.get("/specmarket/v1/getSpecRaw", query_string={"shortId": "A1B2C3D4E5F6G7H8"})
    assert resp.status_code == 200
    assert "Test content" in resp.get_data(as_text=True)


def test_download_spec(client):
    resp = client.get("/specmarket/v1/downloadSpec", query_string={"shortId": "A1B2C3D4E5F6G7H8"})
    assert resp.status_code == 200
    assert resp.headers["Content-Disposition"].startswith("attachment")


def test_list_categories_and_tags(client):
    cat_resp = client.get("/specmarket/v1/listCategories")
    tag_resp = client.get("/specmarket/v1/listTags")
    assert cat_resp.status_code == 200
    assert tag_resp.status_code == 200
    assert cat_resp.get_json()["status_code"] == BusinessErrorCode.SUCCESS
    assert tag_resp.get_json()["status_code"] == BusinessErrorCode.SUCCESS
    assert cat_resp.get_json()["data"]["items"][0]["slug"] == "test"
    assert tag_resp.get_json()["data"]["items"][0]["slug"] == "tag"


def test_upload_spec(client):
    registration = _register_user(client)
    user_id = registration.get_json()["data"]["user"]["id"]
    data = {
        "title": "Uploaded",
        "summary": "Uploaded summary",
        "category": "upload",
        "tags": "upload,example",
    }
    file_content = b"## Overview\nUploaded spec"
    resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**data, "file": (io.BytesIO(file_content), "upload.md")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    assert body["status_msg"] == "success"
    returned_short_id = body["data"]["shortId"]
    assert body["data"]["version"] == 1
    assert len(returned_short_id) == 16
    list_resp = client.get("/specmarket/v1/listSpecs", query_string={"_": returned_short_id})
    assert list_resp.get_json()["data"]["total"] == 2

    collection = mongo_module._collection
    assert isinstance(collection, mongo_module._InMemoryCollection)
    stored = collection.store[returned_short_id]
    expected_keys = {
        "shortId",
        "title",
        "summary",
        "category",
        "tags",
        "author",
        "createdAt",
        "updatedAt",
        "ownerId",
        "version",
    }
    assert set(stored.keys()) == expected_keys
    assert stored["author"] == "@tester"
    assert stored["ownerId"] == user_id
    assert stored["version"] == 1

    history_collection = mongo_module._history_collection
    assert isinstance(history_collection, mongo_module._InMemorySpecHistoryCollection)
    history_doc = history_collection.store[returned_short_id][1]
    assert history_doc["contentMd"].strip().endswith("Uploaded spec")


def test_upload_spec_preserves_short_id_on_update(client):
    _register_user(client)
    data = {
        "title": "Uploaded",
        "summary": "Uploaded summary",
        "category": "upload",
        "tags": "upload,example",
    }
    file_content = b"## Overview\nUploaded spec"
    create_resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**data, "file": (io.BytesIO(file_content), "upload.md")},
        content_type="multipart/form-data",
    )
    assert create_resp.status_code == 201
    short_id = create_resp.get_json()["data"]["shortId"]

    updated_content = b"## Overview\nUpdated spec"
    update_resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={
            **data,
            "shortId": short_id,
            "summary": "Updated summary",
            "file": (io.BytesIO(updated_content), "upload.md"),
        },
        content_type="multipart/form-data",
    )
    assert update_resp.status_code == 201
    assert update_resp.get_json()["data"]["version"] == 2
    detail_resp = client.get("/specmarket/v1/getSpecDetail", query_string={"shortId": short_id})
    detail_data = detail_resp.get_json()["data"]
    assert detail_data["summary"] == "Updated summary"
    assert detail_data["author"] == "@tester"
    assert detail_data["version"] == 2
    history = detail_data["history"]
    assert history["total"] == 2
    versions = [item["version"] for item in history["items"]]
    assert versions[0] == 2
    assert 1 in versions
    list_resp = client.get(
        "/specmarket/v1/listSpecs",
        query_string={"_": f"update-{short_id}"},
    )
    body = list_resp.get_json()
    assert body["data"]["total"] == 2
    assert sum(1 for item in body["data"]["items"] if item["shortId"] == short_id) == 1


def test_get_spec_version_endpoint(client):
    _register_user(client)
    original_md = "## Overview\nOriginal body"
    short_id = _upload_spec(
        client,
        title="Versioned Spec",
        summary="Initial",
        category="history",
        tags="hist,example",
        content=original_md,
        filename="history.md",
    )
    update_payload = {
        "shortId": short_id,
        "title": "Versioned Spec",
        "summary": "Second",
        "category": "history",
        "tags": ["hist", "example"],
        "contentMd": "## Overview\nSecond body",
    }
    resp = client.put("/specmarket/v1/updateSpec", json=update_payload)
    assert resp.status_code == 200

    version_resp = client.get(
        "/specmarket/v1/getSpecVersion",
        query_string={"shortId": short_id, "version": 1},
    )
    assert version_resp.status_code == 200
    payload = version_resp.get_json()
    assert payload["status_code"] == BusinessErrorCode.SUCCESS
    data = payload["data"]
    assert data["version"] == 1
    assert data["isLatest"] is False
    assert data["history"]["latestVersion"] == 2
    assert data["history"]["total"] == 2
    assert any(item["version"] == 1 for item in data["history"]["items"])
    assert data["contentMd"].strip().endswith("Original body")
def test_error_response_contains_trace_and_code(client):
    resp = client.get("/specmarket/v1/getSpecDetail")
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["status_code"] == BusinessErrorCode.INVALID_ARG
    assert payload["status_msg"] == "shortId is required"
    assert payload["data"]["traceId"] == resp.headers["X-Trace-Id"]


def test_update_spec_endpoint(client):
    registration = _register_user(client)
    user_id = registration.get_json()["data"]["user"]["id"]
    upload_data = {
        "title": "Initial Title",
        "summary": "Initial summary",
        "category": "test",
        "tags": "tag,example",
    }
    file_content = io.BytesIO(b"## Overview\nInitial content")
    create_resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**upload_data, "file": (file_content, "spec.md")},
        content_type="multipart/form-data",
    )
    assert create_resp.status_code == 201
    short_id = create_resp.get_json()["data"]["shortId"]

    original_detail = client.get(
        "/specmarket/v1/getSpecDetail",
        query_string={"shortId": short_id},
    ).get_json()["data"]
    original_updated_at = original_detail["updatedAt"]

    client.post("/specmarket/v1/auth/logout")

    update_payload = {
        "shortId": short_id,
        "title": "Test Spec Updated",
        "summary": "Updated summary",
        "category": "test",
        "tags": ["tag", "updated"],
        "contentMd": "## Overview\nUpdated test content",
    }

    unauthorized = client.put("/specmarket/v1/updateSpec", json=update_payload)
    assert unauthorized.status_code == 401
    assert unauthorized.get_json()["status_code"] == BusinessErrorCode.UNAUTHORIZED

    _login_user(client)
    resp = client.put(
        "/specmarket/v1/updateSpec",
        json=update_payload,
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    response_updated_at = body["data"]["updatedAt"]
    assert body["data"]["version"] == 2
    assert "T" in response_updated_at
    assert response_updated_at.endswith("Z")
    assert response_updated_at != original_updated_at
    assert _parse_timestamp(response_updated_at) > _parse_timestamp(original_updated_at)
    detail = client.get(
        "/specmarket/v1/getSpecDetail",
        query_string={"shortId": update_payload["shortId"]},
    ).get_json()["data"]
    assert detail["summary"] == "Updated summary"
    assert detail["title"] == "Test Spec Updated"
    assert detail["author"] == "@tester"
    assert detail["contentMd"].strip().endswith("Updated test content")
    assert "T" in detail["updatedAt"]
    assert detail["updatedAt"] == response_updated_at
    assert detail["version"] == 2
    assert detail["isLatest"] is True
    history_data = detail["history"]
    assert history_data["total"] == 2
    history_versions = [item["version"] for item in history_data["items"]]
    assert history_versions[0] == 2
    assert 1 in history_versions

    collection = mongo_module._collection
    assert isinstance(collection, mongo_module._InMemoryCollection)
    stored = collection.store[update_payload["shortId"]]
    assert stored["summary"] == "Updated summary"
    assert stored["author"] == "@tester"
    assert stored["ownerId"] == user_id
    assert set(stored.keys()) == {
        "shortId",
        "title",
        "summary",
        "category",
        "tags",
        "author",
        "createdAt",
        "updatedAt",
        "ownerId",
        "version",
    }

    history_collection = mongo_module._history_collection
    assert isinstance(history_collection, mongo_module._InMemorySpecHistoryCollection)
    history_docs = history_collection.store[update_payload["shortId"]]
    assert history_docs[2]["contentMd"].strip().endswith("Updated test content")


def test_list_specs_filters_by_author_username(client):
    client.post("/specmarket/v1/auth/logout")
    first_user = "authorone"
    second_user = "authortwo"

    _register_user(client, first_user, "Password123!")
    first_short_id = _upload_spec(
        client,
        title="Author One Spec",
        summary="Spec from author one",
        category="alpha",
        tags="alpha,first",
        content="## Overview\nAuthor one body",
        filename="author-one.md",
    )

    client.post("/specmarket/v1/auth/logout")
    _register_user(client, second_user, "Password123!")
    second_short_id = _upload_spec(
        client,
        title="Author Two Spec",
        summary="Spec from author two",
        category="beta",
        tags="beta,second",
        content="## Overview\nAuthor two body",
        filename="author-two.md",
    )

    first_resp = client.get(
        "/specmarket/v1/listSpecs",
        query_string={"author": first_user},
    )
    assert first_resp.status_code == 200
    first_payload = first_resp.get_json()
    assert first_payload["status_code"] == BusinessErrorCode.SUCCESS
    assert first_payload["data"]["total"] == 1
    first_item = first_payload["data"]["items"][0]
    assert first_item["author"] == f"@{first_user}"
    assert first_item["shortId"] == first_short_id

    second_resp = client.get(
        "/specmarket/v1/listSpecs",
        query_string={"author": second_user},
    )
    assert second_resp.status_code == 200
    second_payload = second_resp.get_json()
    assert second_payload["status_code"] == BusinessErrorCode.SUCCESS
    assert second_payload["data"]["total"] == 1
    second_item = second_payload["data"]["items"][0]
    assert second_item["author"] == f"@{second_user}"
    assert second_item["shortId"] == second_short_id

    none_resp = client.get(
        "/specmarket/v1/listSpecs",
        query_string={"author": "unknown"},
    )
    assert none_resp.status_code == 200
    none_payload = none_resp.get_json()
    assert none_payload["status_code"] == BusinessErrorCode.SUCCESS
    assert none_payload["data"]["total"] == 0
    assert none_payload["data"]["items"] == []


def test_delete_spec_endpoint(client):
    unauthorized = client.delete(
        "/specmarket/v1/deleteSpec",
        json={"shortId": "A1B2C3D4E5F6G7H8"},
    )
    assert unauthorized.status_code == 401
    assert unauthorized.get_json()["status_code"] == BusinessErrorCode.UNAUTHORIZED

    registration = _register_user(client)
    upload_data = {
        "title": "Deletable",
        "summary": "To be removed",
        "category": "test",
        "tags": "cleanup",
    }
    file_content = io.BytesIO(b"## Overview\nDelete me")
    create_resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**upload_data, "file": (file_content, "delete.md")},
        content_type="multipart/form-data",
    )
    assert create_resp.status_code == 201
    short_id = create_resp.get_json()["data"]["shortId"]
    resp = client.delete(
        "/specmarket/v1/deleteSpec",
        json={"shortId": short_id},
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["status_code"] == BusinessErrorCode.SUCCESS
    assert payload["data"]["shortId"] == short_id

    detail = client.get(
        "/specmarket/v1/getSpecDetail",
        query_string={"shortId": short_id},
    )
    assert detail.status_code == 404
    assert detail.get_json()["status_code"] == BusinessErrorCode.NOT_FOUND

    from backend import repository as repository_module

    assert repository_module.repository.get_spec(short_id) is None

    collection = mongo_module._collection
    assert isinstance(collection, mongo_module._InMemoryCollection)
    assert short_id not in collection.store
    history_collection = mongo_module._history_collection
    assert isinstance(history_collection, mongo_module._InMemorySpecHistoryCollection)
    assert short_id not in history_collection.store
