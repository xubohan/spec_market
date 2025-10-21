from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import logging

from pymongo import errors as pymongo_errors

from .models import Category, PaginatedSpecs, Spec, SpecSummary, Tag
from .mongo import list_spec_documents
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
        if self.data_path.exists():
            with open(self.data_path, "r", encoding="utf-8") as f:
                raw_specs = json.load(f)
            for raw in raw_specs:
                spec = self._spec_from_raw(raw)
                self.specs[spec.shortId] = spec
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

    def _spec_from_raw(self, raw: Dict[str, Any]) -> Spec:
        normalized = {**raw}
        normalized.pop("_id", None)
        normalized.pop("uploadedAt", None)
        if "shortId" not in normalized or not is_valid_short_id(str(normalized["shortId"])):
            legacy_slug = normalized.get("slug") or normalized.get("shortId")
            if not legacy_slug:
                raise ValueError("Spec document missing shortId")
            normalized["shortId"] = derive_short_id(str(legacy_slug))
        short_id = str(normalized["shortId"])
        normalized["shortId"] = short_id
        normalized["id"] = normalized.get("id") or f"spec-{short_id}"
        normalized.pop("slug", None)
        if "contentMd" not in normalized or normalized["contentMd"] is None:
            raise ValueError("Spec document missing contentMd")
        md = str(normalized["contentMd"])
        normalized["contentMd"] = md
        normalized["summary"] = str(normalized.get("summary", ""))
        normalized["author"] = str(normalized.get("author", ""))
        tags_value = normalized.get("tags", [])
        if isinstance(tags_value, (list, tuple, set)):
            normalized["tags"] = [str(tag) for tag in tags_value]
        elif tags_value is None:
            normalized["tags"] = []
        else:
            normalized["tags"] = [str(tags_value)]
        normalized.pop("contentHtml", None)
        normalized.pop("toc", None)
        owner_id = normalized.get("ownerId")
        if owner_id is not None:
            normalized["ownerId"] = str(owner_id)
        if "createdAt" in normalized:
            normalized["createdAt"] = self._ensure_timezone(normalized["createdAt"])
        if "updatedAt" in normalized:
            normalized["updatedAt"] = self._ensure_timezone(normalized["updatedAt"])
        return Spec(
            **normalized,
        )

    def _merge_from_mongo(self) -> None:
        try:
            documents = list_spec_documents()
        except pymongo_errors.PyMongoError as exc:
            logging.warning("Failed to load specs from MongoDB: %s", exc)
            return
        for document in documents:
            try:
                spec = self._spec_from_raw(document)
            except Exception as exc:  # pragma: no cover - defensive
                logging.warning("Skipping invalid spec document from MongoDB: %s", exc)
                continue
            self.specs[spec.shortId] = spec

    def list_specs(
        self,
        page: int = 1,
        page_size: int = 10,
        tag: str | None = None,
        category: str | None = None,
        order: str = "-updatedAt",
        search: str | None = None,
        updated_since: datetime | None = None,
    ) -> PaginatedSpecs:
        items = list(self.specs.values())
        if tag:
            items = [spec for spec in items if tag in spec.tags]
        if category:
            items = [spec for spec in items if spec.category == category]
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

    def _persist(self) -> None:
        serialized = [spec.dict(by_alias=True) for spec in self.specs.values()]
        with open(self.data_path, "w", encoding="utf-8") as f:
            json.dump(serialized, f, ensure_ascii=False, indent=2, default=str)

    def refresh_from_document(self, document: Dict[str, Any]) -> None:
        spec = self._spec_from_raw(document)
        self.specs[spec.shortId] = spec

    def delete_spec(self, short_id: str) -> bool:
        removed = self.specs.pop(short_id, None) is not None
        if removed:
            try:
                self._persist()
            except OSError as exc:  # pragma: no cover - defensive
                logging.warning("Failed to persist spec deletion: %s", exc)
        return removed


repository = SpecRepository()
