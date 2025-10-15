from __future__ import annotations

import io

from backend.config import settings


def test_list_specs(client):
    resp = client.get("/specmarket/v1/listSpecs")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["data"]["total"] == 1


def test_get_spec_detail(client):
    resp = client.get("/specmarket/v1/getSpecDetail", query_string={"slug": "test-spec"})
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["slug"] == "test-spec"
    assert "contentHtml" in data


def test_get_spec_raw(client):
    resp = client.get("/specmarket/v1/getSpecRaw", query_string={"slug": "test-spec"})
    assert resp.status_code == 200
    assert "Test content" in resp.get_data(as_text=True)


def test_download_spec(client):
    resp = client.get("/specmarket/v1/downloadSpec", query_string={"slug": "test-spec"})
    assert resp.status_code == 200
    assert resp.headers["Content-Disposition"].startswith("attachment")


def test_list_categories_and_tags(client):
    cat_resp = client.get("/specmarket/v1/listCategories")
    tag_resp = client.get("/specmarket/v1/listTags")
    assert cat_resp.status_code == 200
    assert tag_resp.status_code == 200
    assert cat_resp.get_json()["data"]["items"][0]["slug"] == "test"
    assert tag_resp.get_json()["data"]["items"][0]["slug"] == "tag"


def test_upload_spec(client):
    data = {
        "title": "Uploaded",
        "slug": "uploaded-spec",
        "summary": "Uploaded summary",
        "category": "upload",
        "tags": "upload,example",
        "version": "2",
    }
    file_content = b"## Overview\nUploaded spec"
    resp = client.post(
        "/specmarket/v1/uploadSpec",
        data={**data, "file": (io.BytesIO(file_content), "upload.md")},
        headers={"X-Admin-Token": settings.admin_token},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    list_resp = client.get("/specmarket/v1/listSpecs")
    assert list_resp.get_json()["data"]["total"] == 2
