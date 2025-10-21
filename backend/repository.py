from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import logging

from pymongo import errors as pymongo_errors

from .models import (
    Category,
    PaginatedSpecs,
    Spec,
    SpecHistoryItem,
    SpecMetadata,
    SpecSummary,
    SpecVersion,
    Tag,
)
from .mongo import (
    find_latest_spec_version_document,
    find_spec_version_document,
    list_spec_documents,
    list_spec_version_documents,
)
from .utils import derive_short_id, is_valid_short_id, slugify

DATA_DIR = Path(__file__).parent / "data"


def _resolve_data_path(data_path: Path | None) -> Path:
    if data_path:
        return data_path
    env_path = os.getenv("SPEC_DATA_PATH")
    if env_path:
        return Path(env_path)
    return DATA_DIR / "specs.json"


class SpecRepository:
    def __init__(self, data_path: Path | None = None) -> None:
        self.data_path = _resolve_data_path(data_path)
        self._load()

    def _load(self) -> None:
        self.specs: Dict[str, Spec] = {}
        self.metadata: Dict[str, SpecMetadata] = {}
        if self.data_path.exists():
            with open(self.data_path, "r", encoding="utf-8") as f:
                raw_specs = json.load(f)
            for raw in raw_specs:
                spec = self._spec_from_raw(raw)
                self.specs[spec.shortId] = spec
                self.metadata[spec.shortId] = self._metadata_from_spec(spec)
        else:
            logging.info("Spec data file %s not found; loading from MongoDB only", self.data_path)
        self._merge_from_mongo()

    def _ensure_timezone(self, value: Any) -> datetime:
        if isinstance(value, str):
            normalized = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(normalized)
        elif isinstance(value, datetime):
            dt = value
        else:
            raise TypeError(f"Unsupported datetime value: {value!r}")
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def _normalize_metadata_fields(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        normalized: Dict[str, Any] = {**raw}
        normalized.pop("_id", None)
        normalized.pop("uploadedAt", None)
        normalized.pop("contentHtml", None)
        normalized.pop("toc", None)
        if "shortId" not in normalized or not is_valid_short_id(str(normalized["shortId"])):
            legacy_slug = normalized.get("slug") or normalized.get("shortId")
            if not legacy_slug:
                raise ValueError("Spec document missing shortId")
            normalized["shortId"] = derive_short_id(str(legacy_slug))
        short_id = str(normalized["shortId"])
        normalized["shortId"] = short_id
        normalized["id"] = str(normalized.get("id") or f"spec-{short_id}")
        normalized.pop("slug", None)
        normalized["title"] = str(normalized.get("title", ""))
        normalized["summary"] = str(normalized.get("summary", ""))
        normalized["category"] = str(normalized.get("category", ""))
        normalized["author"] = str(normalized.get("author", ""))
        tags_value = normalized.get("tags", [])
        if isinstance(tags_value, (list, tuple, set)):
            normalized["tags"] = [str(tag) for tag in tags_value]
        elif tags_value is None:
            normalized["tags"] = []
        else:
            normalized["tags"] = [str(tags_value)]
        owner_id = normalized.get("ownerId")
        if owner_id is not None:
            normalized["ownerId"] = str(owner_id)
        if "createdAt" in normalized:
            normalized["createdAt"] = self._ensure_timezone(normalized["createdAt"])
        else:
            raise ValueError("Spec document missing createdAt")
        if "updatedAt" in normalized:
            normalized["updatedAt"] = self._ensure_timezone(normalized["updatedAt"])
        else:
            normalized["updatedAt"] = normalized["createdAt"]
        version_value = normalized.get("version", 1)
        try:
            normalized["version"] = max(int(version_value), 1)
        except (TypeError, ValueError):
            normalized["version"] = 1
        return normalized

    def _metadata_from_raw(self, raw: Dict[str, Any]) -> SpecMetadata:
        normalized = self._normalize_metadata_fields(raw)
        return SpecMetadata(
            id=str(normalized["id"]),
            title=normalized["title"],
            shortId=normalized["shortId"],
            summary=normalized["summary"],
            category=normalized["category"],
            tags=list(normalized["tags"]),
            author=normalized["author"],
            ownerId=normalized.get("ownerId"),
            createdAt=normalized["createdAt"],
            updatedAt=normalized["updatedAt"],
            version=normalized["version"],
        )

    def _metadata_from_spec(self, spec: Spec) -> SpecMetadata:
        return SpecMetadata(
            id=spec.id,
            title=spec.title,
            shortId=spec.shortId,
            summary=spec.summary,
            category=spec.category,
            tags=list(spec.tags),
            author=spec.author,
            ownerId=spec.ownerId,
            createdAt=spec.createdAt,
            updatedAt=spec.updatedAt,
            version=spec.version,
        )

    def _spec_version_from_raw(self, raw: Dict[str, Any]) -> SpecVersion:
        normalized = self._normalize_metadata_fields(raw)
        content_md = raw.get("contentMd")
        if content_md is None:
            content_md = normalized.get("contentMd")
        if content_md is None:
            raise ValueError("Spec version document missing contentMd")
        normalized["contentMd"] = str(content_md)
        return SpecVersion(
            shortId=normalized["shortId"],
            version=normalized["version"],
            title=normalized["title"],
            summary=normalized["summary"],
            category=normalized["category"],
            tags=list(normalized["tags"]),
            author=normalized["author"],
            contentMd=normalized["contentMd"],
            createdAt=normalized["createdAt"],
            updatedAt=normalized["updatedAt"],
        )

    def _combine_metadata_and_version(self, metadata: SpecMetadata, version: SpecVersion) -> Spec:
        return Spec(
            id=metadata.id,
            title=version.title,
            shortId=metadata.shortId,
            summary=version.summary,
            category=version.category,
            tags=list(version.tags),
            author=version.author,
            ownerId=metadata.ownerId,
            createdAt=metadata.createdAt,
            updatedAt=version.updatedAt,
            version=version.version,
            contentMd=version.contentMd,
        )

    def _spec_from_raw(self, raw: Dict[str, Any]) -> Spec:
        metadata = self._metadata_from_raw(raw)
        version = self._spec_version_from_raw(raw)
        return self._combine_metadata_and_version(metadata, version)

    def _history_item_from_raw(self, raw: Dict[str, Any]) -> SpecHistoryItem:
        version = self._spec_version_from_raw(raw)
        return SpecHistoryItem(
            shortId=version.shortId,
            version=version.version,
            title=version.title,
            summary=version.summary,
            author=version.author,
            updatedAt=version.updatedAt,
        )

    def _merge_from_mongo(self) -> None:
        try:
            documents = list_spec_documents()
        except pymongo_errors.PyMongoError as exc:
            logging.warning("Failed to load specs from MongoDB: %s", exc)
            return
        for document in documents:
            try:
                metadata = self._metadata_from_raw(document)
            except Exception as exc:  # pragma: no cover - defensive
                logging.warning("Skipping invalid spec metadata from MongoDB: %s", exc)
                continue
            version_document = find_latest_spec_version_document(metadata.shortId)
            if not version_document:
                logging.warning("Missing version document for spec %s", metadata.shortId)
                continue
            try:
                version = self._spec_version_from_raw(version_document)
            except Exception as exc:  # pragma: no cover - defensive
                logging.warning("Skipping invalid spec version from MongoDB: %s", exc)
                continue
            spec = self._combine_metadata_and_version(metadata, version)
            self.metadata[spec.shortId] = metadata
            self.specs[spec.shortId] = spec

    def list_specs(
        self,
        page: int = 1,
        page_size: int = 10,
        tag: str | None = None,
        category: str | None = None,
        order: str = "-updatedAt",
        search: str | None = None,
        author: str | None = None,
        updated_since: datetime | None = None,
    ) -> PaginatedSpecs:
        items = list(self.specs.values())
        if tag:
            items = [spec for spec in items if tag in spec.tags]
        if category:
            items = [spec for spec in items if spec.category == category]
        if author:
            normalized_query = author.strip().lstrip("@").lower()
            if normalized_query:
                filtered: List[Spec] = []
                for spec in items:
                    raw_author = (spec.author or "").strip()
                    if not raw_author:
                        continue
                    candidates = {raw_author.lower()}
                    stripped = raw_author.lstrip("@")
                    if stripped:
                        candidates.add(stripped.lower())
                    if normalized_query in candidates:
                        filtered.append(spec)
                items = filtered
        if search:
            lowered = search.lower()
            items = [
                spec
                for spec in items
                if lowered in spec.title.lower()
                or lowered in spec.summary.lower()
                or any(lowered in tag.lower() for tag in spec.tags)
            ]
        if updated_since:
            items = [spec for spec in items if spec.updatedAt >= updated_since]
        reverse = order.startswith("-")
        key = order.lstrip("-")
        if key == "updatedAt":
            items.sort(key=lambda s: s.updatedAt, reverse=reverse)
        start = (page - 1) * page_size
        end = start + page_size
        summaries = [SpecSummary(**spec.dict()) for spec in items[start:end]]
        return PaginatedSpecs(
            total=len(items),
            page=page,
            pageSize=page_size,
            items=summaries,
        )

    def get_spec(self, short_id: str) -> Spec | None:
        return self.specs.get(short_id)

    def get_spec_version(self, short_id: str, version: int) -> Spec | None:
        latest = self.get_spec(short_id)
        if latest and latest.version == version:
            return latest
        metadata = self.metadata.get(short_id)
        if metadata is None and latest is not None:
            metadata = self._metadata_from_spec(latest)
            self.metadata[short_id] = metadata
        if metadata is None:
            logging.warning("Metadata missing for spec %s", short_id)
            return None
        document = find_spec_version_document(short_id, version)
        if not document:
            return None
        try:
            version_model = self._spec_version_from_raw(document)
        except Exception as exc:  # pragma: no cover - defensive
            logging.warning("Skipping invalid spec version document: %s", exc)
            return None
        return self._combine_metadata_and_version(metadata, version_model)

    def list_categories(self) -> List[Category]:
        counts: Dict[str, int] = {}
        for spec in self.specs.values():
            counts[spec.category] = counts.get(spec.category, 0) + 1
        categories = [Category(name=key.title(), slug=slugify(key), count=value)
                      for key, value in counts.items()]
        categories.sort(key=lambda c: c.name.lower())
        return categories

    def list_tags(self) -> List[Tag]:
        counts: Dict[str, int] = {}
        for spec in self.specs.values():
            for tag in spec.tags:
                counts[tag] = counts.get(tag, 0) + 1
        tags = [Tag(name=key.title(), slug=slugify(key), count=value)
                for key, value in counts.items()]
        tags.sort(key=lambda t: t.name.lower())
        return tags

    def add_spec(self, spec: Spec) -> None:
        self.specs[spec.shortId] = spec
        self.metadata[spec.shortId] = self._metadata_from_spec(spec)

    def get_spec_history(self, short_id: str) -> List[SpecHistoryItem]:
        documents = list_spec_version_documents(short_id)
        items: List[SpecHistoryItem] = []
        for document in documents:
            try:
                item = self._history_item_from_raw(document)
            except Exception as exc:  # pragma: no cover - defensive
                logging.warning("Skipping invalid spec history entry: %s", exc)
                continue
            items.append(item)
        latest_spec = self.specs.get(short_id)
        versions_present = {item.version for item in items}
        if latest_spec and latest_spec.version not in versions_present:
            items.append(
                SpecHistoryItem(
                    shortId=latest_spec.shortId,
                    version=latest_spec.version,
                    title=latest_spec.title,
                    summary=latest_spec.summary,
                    author=latest_spec.author,
                    updatedAt=latest_spec.updatedAt,
                )
            )
        items.sort(key=lambda entry: entry.version, reverse=True)
        return items

    def _persist(self) -> None:
        serialized = [spec.dict(by_alias=True) for spec in self.specs.values()]
        with open(self.data_path, "w", encoding="utf-8") as f:
            json.dump(serialized, f, ensure_ascii=False, indent=2, default=str)

    def refresh_from_document(
        self,
        metadata_document: Dict[str, Any],
        version_document: Dict[str, Any] | None = None,
    ) -> None:
        try:
            metadata = self._metadata_from_raw(metadata_document)
        except Exception as exc:  # pragma: no cover - defensive
            logging.warning("Skipping refresh with invalid metadata document: %s", exc)
            return
        if version_document is None:
            candidate = metadata_document if "contentMd" in metadata_document else None
            version_document = candidate or find_latest_spec_version_document(metadata.shortId)
        if not version_document:
            logging.warning("Missing version document while refreshing spec %s", metadata.shortId)
            return
        try:
            version = self._spec_version_from_raw(version_document)
        except Exception as exc:  # pragma: no cover - defensive
            logging.warning("Skipping refresh with invalid version document: %s", exc)
            return
        spec = self._combine_metadata_and_version(metadata, version)
        self.metadata[metadata.shortId] = metadata
        self.specs[spec.shortId] = spec

    def delete_spec(self, short_id: str) -> bool:
        removed_spec = self.specs.pop(short_id, None)
        self.metadata.pop(short_id, None)
        if removed_spec is not None:
            try:
                self._persist()
            except OSError as exc:  # pragma: no cover - defensive
                logging.warning("Failed to persist spec deletion: %s", exc)
            return True
        return False


repository = SpecRepository()
