from __future__ import annotations

import json
import os
from datetime import datetime, timezone
import logging
from pathlib import Path
from typing import Any, Dict, List

from pymongo import errors as pymongo_errors

from .models import Category, PaginatedSpecs, Spec, SpecSummary, Tag
from .mongo import list_spec_documents
from .utils import build_toc, render_markdown, slugify

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
        with open(self.data_path, "r", encoding="utf-8") as f:
            raw_specs = json.load(f)
        self.specs: Dict[str, Spec] = {}
        for raw in raw_specs:
            spec = self._spec_from_raw(raw)
            self.specs[spec.slug] = spec
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
        md = normalized["contentMd"]
        toc = build_toc(md.splitlines())
        html = render_markdown(md)
        normalized.pop("contentHtml", None)
        normalized.pop("toc", None)
        if "updatedAt" in normalized:
            normalized["updatedAt"] = self._ensure_timezone(normalized["updatedAt"])
        return Spec(
            **normalized,
            contentHtml=html,
            toc=toc,
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
            self.specs[spec.slug] = spec

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

    def get_spec(self, slug: str) -> Spec | None:
        return self.specs.get(slug)

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
        self.specs[spec.slug] = spec

    def _persist(self) -> None:
        serialized = [spec.dict(by_alias=True) for spec in self.specs.values()]
        with open(self.data_path, "w", encoding="utf-8") as f:
            json.dump(serialized, f, ensure_ascii=False, indent=2, default=str)

    def refresh_from_document(self, document: Dict[str, Any]) -> None:
        spec = self._spec_from_raw(document)
        self.specs[spec.slug] = spec


repository = SpecRepository()
