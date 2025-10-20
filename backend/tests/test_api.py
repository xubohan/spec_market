from __future__ import annotations

import io
from datetime import datetime, timezone

from backend.config import settings
from backend.models import BusinessErrorCode
from backend import mongo as mongo_module


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
    repo.refresh_from_document(
        {
            "id": "spec-2",
            "title": "Naive datetime spec",
            "shortId": "B7C8D9E0F1G2H3I4",
            "summary": "Summary",
            "category": "test",
            "tags": ["tag"],
            "contentMd": "## Overview\nNaive content",
            "author": "Demo Author",
            "createdAt": datetime.now(timezone.utc).replace(tzinfo=None),
            "updatedAt": datetime.now(timezone.utc).replace(tzinfo=None),
        }
    )

    resp = client.get("/specmarket/v1/listSpecs", query_string={"filter": "today"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["shortId"] == "B7C8D9E0F1G2H3I4"
    repo.specs.pop("B7C8D9E0F1G2H3I4", None)


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
    data = {
        "title": "Uploaded",
        "summary": "Uploaded summary",
        "category": "upload",
        "tags": "upload,example",
        "author": "Release Bot",
    }
    file_content = b"## Overview\nUploaded spec"
    resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**data, "file": (io.BytesIO(file_content), "upload.md")},
        headers={"X-Admin-Token": settings.admin_token},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    assert body["status_msg"] == "success"
    returned_short_id = body["data"]["shortId"]
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
        "contentMd",
        "createdAt",
        "updatedAt",
    }
    assert set(stored.keys()) == expected_keys


def test_upload_spec_preserves_short_id_on_update(client):
    data = {
        "title": "Uploaded",
        "summary": "Uploaded summary",
        "category": "upload",
        "tags": "upload,example",
        "author": "Release Bot",
    }
    file_content = b"## Overview\nUploaded spec"
    create_resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**data, "file": (io.BytesIO(file_content), "upload.md")},
        headers={"X-Admin-Token": settings.admin_token},
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
        headers={"X-Admin-Token": settings.admin_token},
        content_type="multipart/form-data",
    )
    assert update_resp.status_code == 201
    detail_resp = client.get("/specmarket/v1/getSpecDetail", query_string={"shortId": short_id})
    detail_data = detail_resp.get_json()["data"]
    assert detail_data["summary"] == "Updated summary"
    list_resp = client.get(
        "/specmarket/v1/listSpecs",
        query_string={"_": f"update-{short_id}"},
    )
    body = list_resp.get_json()
    assert body["data"]["total"] == 2
    assert sum(1 for item in body["data"]["items"] if item["shortId"] == short_id) == 1


def test_error_response_contains_trace_and_code(client):
    resp = client.get("/specmarket/v1/getSpecDetail")
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["status_code"] == BusinessErrorCode.INVALID_ARG
    assert payload["status_msg"] == "shortId is required"
    assert payload["data"]["traceId"] == resp.headers["X-Trace-Id"]


def test_update_spec_endpoint(client):
    update_payload = {
        "shortId": "A1B2C3D4E5F6G7H8",
        "title": "Test Spec Updated",
        "summary": "Updated summary",
        "category": "test",
        "tags": ["tag", "updated"],
        "author": "QA Team",
        "contentMd": "## Overview\nUpdated test content",
    }

    unauthorized = client.put("/specmarket/v1/updateSpec", json=update_payload)
    assert unauthorized.status_code == 401
    assert unauthorized.get_json()["status_code"] == BusinessErrorCode.UNAUTHORIZED

    resp = client.put(
        "/specmarket/v1/updateSpec",
        json=update_payload,
        headers={"X-Admin-Token": settings.admin_token},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["status_code"] == BusinessErrorCode.SUCCESS
    detail = client.get(
        "/specmarket/v1/getSpecDetail",
        query_string={"shortId": update_payload["shortId"]},
    ).get_json()["data"]
    assert detail["summary"] == "Updated summary"
    assert detail["title"] == "Test Spec Updated"
    assert detail["contentMd"].strip().endswith("Updated test content")

    collection = mongo_module._collection
    assert isinstance(collection, mongo_module._InMemoryCollection)
    stored = collection.store[update_payload["shortId"]]
    assert stored["summary"] == "Updated summary"
    assert stored["contentMd"].strip().endswith("Updated test content")
    assert set(stored.keys()) == {
        "shortId",
        "title",
        "summary",
        "category",
        "tags",
        "author",
        "contentMd",
        "createdAt",
        "updatedAt",
    }
