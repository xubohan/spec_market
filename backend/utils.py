from __future__ import annotations

import hashlib
import re
from datetime import datetime
from typing import Iterable, List

import bleach
from markdown import markdown

HEADING_PATTERN = re.compile(r"^(#{2,6})\\s+(.*)")


def slugify(text: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9\-\s]", "", text).strip().lower()
    return re.sub(r"\s+", "-", sanitized)


def build_toc(markdown_lines: Iterable[str]) -> List[dict]:
    toc = []
    for line in markdown_lines:
        match = HEADING_PATTERN.match(line)
        if not match:
            continue
        level = len(match.group(1))
        text = match.group(2).strip()
        toc.append({"text": text, "id": slugify(text), "level": level})
    return toc


ALLOWED_TAGS = list(bleach.sanitizer.ALLOWED_TAGS) + [
    "p",
    "pre",
    "code",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "blockquote",
]

ALLOWED_ATTRIBUTES = {
    **bleach.sanitizer.ALLOWED_ATTRIBUTES,
    "a": ["href", "title", "rel"],
    "code": ["class"],
    "pre": ["class"],
}


def render_markdown(md_text: str) -> str:
    html = markdown(md_text, extensions=["extra", "codehilite", "toc", "tables"])
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)


def compute_etag(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def http_datetime(dt: datetime) -> str:
    return dt.strftime("%a, %d %b %Y %H:%M:%S GMT")
