from __future__ import annotations

from __future__ import annotations

import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient, errors
from pymongo.collection import Collection

from .config import settings

_client: MongoClient | None = None
_collection: Collection | "_InMemorySpecCollection" | None = None
_history_collection: Collection | "_InMemorySpecHistoryCollection" | None = None
_user_collection: Collection | "_InMemoryUserCollection" | None = None


class _InMemorySpecCollection:
    def __init__(self) -> None:
        self.store: Dict[str, Dict[str, Any]] = {}

    def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> None:
        short_id = filter.get("shortId")
        if short_id is None:
            raise ValueError("shortId filter is required for in-memory fallback")
        if "$set" not in update:
            raise ValueError("$set update is required for in-memory fallback")
        if not upsert and short_id not in self.store:
            return
        self.store[short_id] = dict(update["$set"])

    def find(self, filter: Dict[str, Any] | None = None) -> Iterable[Dict[str, Any]]:
        return [dict(value) for value in self.store.values()]

    def delete_one(self, filter: Dict[str, Any]) -> None:
        short_id = filter.get("shortId")
        if short_id is None:
            raise ValueError("shortId filter is required for in-memory fallback")
        self.store.pop(short_id, None)


class _InMemorySpecHistoryCollection:
    def __init__(self) -> None:
        self.store: Dict[str, Dict[int, Dict[str, Any]]] = {}

    def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> None:
        short_id = filter.get("shortId")
        version = filter.get("version")
        if short_id is None or version is None:
            raise ValueError("shortId and version filters are required for history fallback")
        if "$set" not in update:
            raise ValueError("$set update is required for history fallback")
        versions = self.store.setdefault(short_id, {})
        versions[int(version)] = dict(update["$set"])

    def find(self, filter: Dict[str, Any] | None = None) -> Iterable[Dict[str, Any]]:
        if not filter or "shortId" not in filter:
            return [dict(doc) for versions in self.store.values() for doc in versions.values()]
        versions = self.store.get(filter["shortId"], {})
        return [dict(doc) for doc in versions.values()]

    def find_one(self, filter: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        short_id = filter.get("shortId")
        version = filter.get("version")
        if short_id is None or version is None:
            return None
        doc = self.store.get(short_id, {}).get(int(version))
        return dict(doc) if doc else None

    def delete_many(self, filter: Dict[str, Any]) -> None:
        short_id = filter.get("shortId")
        if short_id is None:
            return
        self.store.pop(short_id, None)


class _InMemoryUserCollection:
    def __init__(self) -> None:
        self.store: Dict[str, Dict[str, Any]] = {}

    def insert_one(self, document: Dict[str, Any]) -> SimpleNamespace:
        username = document.get("username")
        for existing in self.store.values():
            if existing.get("username") == username:
                raise errors.DuplicateKeyError("username already exists")
        doc = dict(document)
        identifier = doc.get("_id") or ObjectId()
        doc["_id"] = identifier
        self.store[str(identifier)] = doc
        return SimpleNamespace(inserted_id=identifier)

    def find_one(self, filter: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not filter:
            return None
        if "_id" in filter:
            identifier = filter["_id"]
            key = str(identifier)
            stored = self.store.get(key)
            return dict(stored) if stored else None
        username = filter.get("username")
        if username is None:
            return None
        for stored in self.store.values():
            if stored.get("username") == username:
                return dict(stored)
        return None

    def update_one(self, filter: Dict[str, Any], update: Dict[str, Any]) -> None:
        document = self.find_one(filter)
        if not document:
            return
        if "$set" in update:
            document.update(update["$set"])
            self.store[str(document["_id"])] = document


# Backwards compatibility for tests that import _InMemoryCollection
_InMemoryCollection = _InMemorySpecCollection


def _normalize_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise TypeError(f"Unsupported datetime value: {value!r}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _normalize_user_document(document: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(document)
    if "_id" in normalized:
        normalized["_id"] = str(normalized["_id"])
    for key in ("createdAt", "updatedAt"):
        if key in normalized:
            normalized[key] = _normalize_datetime(normalized[key])
    return normalized


def _init_client() -> None:
    global _client, _collection, _history_collection, _user_collection
    if _collection is not None and _user_collection is not None and _history_collection is not None:
        return
    try:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
        _client.admin.command("ping")
        db = _client[settings.mongo_db]
        _collection = db["specs"]
        _history_collection = db["spec_versions"]
        _user_collection = db["users"]
        try:
            _user_collection.create_index("username", unique=True)
        except errors.PyMongoError as exc:
            logging.warning("Failed to ensure username index: %s", exc)
    except errors.PyMongoError as exc:
        logging.warning("MongoDB unavailable, using in-memory fallback: %s", exc)
        _client = None
        _collection = _InMemorySpecCollection()
        _history_collection = _InMemorySpecHistoryCollection()
        _user_collection = _InMemoryUserCollection()


def get_spec_collection() -> Collection | _InMemorySpecCollection:
    if _collection is None:
        _init_client()
    return _collection  # type: ignore[return-value]


def get_user_collection() -> Collection | _InMemoryUserCollection:
    if _user_collection is None:
        _init_client()
    return _user_collection  # type: ignore[return-value]


def save_spec_document(document: Dict[str, Any]) -> None:
    collection = get_spec_collection()
    collection.update_one({"shortId": document["shortId"]}, {"$set": document}, upsert=True)


def get_history_collection() -> Collection | _InMemorySpecHistoryCollection:
    if _history_collection is None:
        _init_client()
    return _history_collection  # type: ignore[return-value]


def save_spec_version_document(document: Dict[str, Any]) -> None:
    history = get_history_collection()
    history.update_one(
        {"shortId": document["shortId"], "version": document["version"]},
        {"$set": document},
        upsert=True,
    )


def list_spec_documents() -> List[Dict[str, Any]]:
    collection = get_spec_collection()
    try:
        cursor = collection.find({})  # type: ignore[attr-defined]
    except AttributeError:
        logging.warning("Mongo collection does not support find(); returning empty list")
        return []
    return [dict(doc) for doc in cursor]


def list_spec_version_documents(short_id: str) -> List[Dict[str, Any]]:
    history = get_history_collection()
    try:
        cursor = history.find({"shortId": short_id})  # type: ignore[attr-defined]
    except AttributeError:
        logging.warning("History collection does not support find(); returning empty list")
        return []
    return [dict(doc) for doc in cursor]


def find_latest_spec_version_document(short_id: str) -> Optional[Dict[str, Any]]:
    history = get_history_collection()
    try:
        cursor = history.find({"shortId": short_id}).sort("version", -1).limit(1)  # type: ignore[attr-defined]
        for doc in cursor:
            return dict(doc)
        return None
    except AttributeError:
        documents = list_spec_version_documents(short_id)
        if not documents:
            return None
        documents.sort(key=lambda doc: int(doc.get("version", 0)), reverse=True)
        return dict(documents[0])


def find_spec_version_document(short_id: str, version: int) -> Optional[Dict[str, Any]]:
    history = get_history_collection()
    try:
        document = history.find_one({"shortId": short_id, "version": version})  # type: ignore[attr-defined]
    except AttributeError:
        logging.warning("History collection does not support find_one(); returning None")
        return None
    return dict(document) if document else None


def delete_spec_document(short_id: str) -> None:
    collection = get_spec_collection()
    try:
        collection.delete_one({"shortId": short_id})  # type: ignore[attr-defined]
    except AttributeError:
        logging.warning("Mongo collection does not support delete_one(); skipping delete")


def delete_spec_versions(short_id: str) -> None:
    history = get_history_collection()
    try:
        history.delete_many({"shortId": short_id})  # type: ignore[attr-defined]
    except AttributeError:
        logging.warning("History collection does not support delete_many(); skipping delete")


def create_user_document(username: str, password_hash: str) -> Dict[str, Any]:
    collection = get_user_collection()
    now = datetime.now(timezone.utc)
    document = {
        "username": username,
        "passwordHash": password_hash,
        "createdAt": now,
        "updatedAt": now,
    }
    result = collection.insert_one(document)  # type: ignore[attr-defined]
    inserted_id = getattr(result, "inserted_id", None)
    if inserted_id is None:
        inserted_id = document.get("_id") or ObjectId()
    created = find_user_document_by_id(str(inserted_id))
    if created is not None:
        return created
    # Fallback for collections that don't immediately expose the inserted document
    document["_id"] = inserted_id
    return _normalize_user_document(document)


def find_user_document_by_username(username: str) -> Optional[Dict[str, Any]]:
    collection = get_user_collection()
    document = collection.find_one({"username": username})  # type: ignore[attr-defined]
    if not document:
        return None
    return _normalize_user_document(document)


def find_user_document_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    collection = get_user_collection()
    document = None
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        object_id = None
    if object_id is not None:
        document = collection.find_one({"_id": object_id})  # type: ignore[attr-defined]
    if document is None:
        document = collection.find_one({"_id": user_id})  # type: ignore[attr-defined]
    if not document:
        return None
    return _normalize_user_document(document)


def update_user_timestamp(user_id: str) -> None:
    collection = get_user_collection()
    now = datetime.now(timezone.utc)
    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        object_id = user_id
    collection.update_one({"_id": object_id}, {"$set": {"updatedAt": now}})  # type: ignore[attr-defined]


