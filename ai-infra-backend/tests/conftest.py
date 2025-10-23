from __future__ import annotations

import json
import os
from pathlib import Path
import sys
from typing import Generator

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import importlib

app_module = importlib.import_module("backend.app")
repository_module = importlib.import_module("backend.repository")
mongo_module = importlib.import_module("backend.mongo")
from backend.app import create_app
from backend.repository import SpecRepository


@pytest.fixture(autouse=True)
def override_repository(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Generator[None, None, None]:
    data = [
        {
            "title": "Test Spec",
            "shortId": "A1B2C3D4E5F6G7H8",
            "summary": "Summary",
            "category": "test",
            "tags": ["tag"],
            "contentMd": "## Overview\nTest content",
            "author": "QA Team",
            "createdAt": "2023-12-25T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
            "version": 1,
        }
    ]
    data_path = tmp_path / "specs.json"
    data_path.write_text(json.dumps(data), encoding="utf-8")
    mongo_module._collection = mongo_module._InMemoryCollection()
    mongo_module._history_collection = mongo_module._InMemorySpecHistoryCollection()
    mongo_module._user_collection = mongo_module._InMemoryUserCollection()
    mongo_module._client = None
    repo = SpecRepository(data_path=data_path)
    monkeypatch.setattr(app_module, "repository", repo)
    monkeypatch.setattr(repository_module, "repository", repo)
    yield


@pytest.fixture
def client():
    app = create_app()
    app.config.update({"TESTING": True})
    with app.test_client() as client:
        yield client
