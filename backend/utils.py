from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime
from typing import Iterable, List

import bleach
from markdown import markdown

HEADING_PATTERN = re.compile(r"^(#{2,6})\\s+(.*)")

BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
SHORT_ID_LENGTH = 16
SHORT_ID_PATTERN = re.compile(rf"^[{BASE62_ALPHABET}]{{{SHORT_ID_LENGTH}}}$")


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


def _encode_base62(number: int, length: int = SHORT_ID_LENGTH) -> str:
    if number < 0:
        raise ValueError("number must be non-negative")
    if number == 0:
        return BASE62_ALPHABET[0] * length
    chars: List[str] = []
    base = len(BASE62_ALPHABET)
    while number > 0:
        number, remainder = divmod(number, base)
        chars.append(BASE62_ALPHABET[remainder])
    encoded = "".join(reversed(chars))
    if len(encoded) > length:
        return encoded[-length:]
    return encoded.rjust(length, BASE62_ALPHABET[0])


def generate_short_id() -> str:
    """Return a cryptographically secure random short ID."""

    max_value = len(BASE62_ALPHABET) ** SHORT_ID_LENGTH
    random_value = secrets.randbelow(max_value)
    return _encode_base62(random_value, SHORT_ID_LENGTH)


def derive_short_id(value: str) -> str:
    """Derive a deterministic short ID from an arbitrary string."""

    digest = hashlib.sha1(value.encode("utf-8")).digest()
    number = int.from_bytes(digest, "big")
    return _encode_base62(number, SHORT_ID_LENGTH)


def is_valid_short_id(value: str) -> bool:
    return bool(SHORT_ID_PATTERN.fullmatch(value))
