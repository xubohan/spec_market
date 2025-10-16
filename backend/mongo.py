from __future__ import annotations

import logging
from typing import Any, Dict

from pymongo import MongoClient, errors
from pymongo.collection import Collection

from .config import settings

_client: MongoClient | None = None
_collection: Collection | "_InMemoryCollection" | None = None


class _InMemoryCollection:
    def __init__(self) -> None:
        self.store: Dict[str, Dict[str, Any]] = {}

    def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> None:
        slug = filter.get("slug")
        if slug is None:
            raise ValueError("slug filter is required for in-memory fallback")
        if "$set" not in update:
            raise ValueError("$set update is required for in-memory fallback")
        if not upsert and slug not in self.store:
            return
        self.store[slug] = dict(update["$set"])


def _init_client() -> None:
    global _client, _collection
    if _collection is not None:
        return
    try:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
        _client.admin.command("ping")
        db = _client[settings.mongo_db]
        _collection = db["specs"]
    except errors.PyMongoError as exc:
        logging.warning("MongoDB unavailable, using in-memory fallback: %s", exc)
        _client = None
        _collection = _InMemoryCollection()


def get_collection() -> Collection | _InMemoryCollection:
    if _collection is None:
        _init_client()
    return _collection


def save_spec_document(document: Dict[str, Any]) -> None:
    collection = get_collection()
    collection.update_one({"slug": document["slug"]}, {"$set": document}, upsert=True)
