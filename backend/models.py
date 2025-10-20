from __future__ import annotations

from datetime import datetime
from enum import IntEnum, unique
from typing import Any, Dict, List, Optional

import re
from pydantic import BaseModel, Field, validator
from .utils import BASE62_ALPHABET, SHORT_ID_LENGTH


@unique
class BusinessErrorCode(IntEnum):
    SUCCESS = 0
    INVALID_ARG = 1001
    NOT_FOUND = 1004
    UNAUTHORIZED = 1003
    INTERNAL = 1500

    @property
    def default_message(self) -> str:
        return _ERROR_MESSAGES[self]


_ERROR_MESSAGES = {
    BusinessErrorCode.SUCCESS: "success",
    BusinessErrorCode.INVALID_ARG: "Invalid argument",
    BusinessErrorCode.NOT_FOUND: "Resource not found",
    BusinessErrorCode.UNAUTHORIZED: "Unauthorized",
    BusinessErrorCode.INTERNAL: "Internal server error",
}


SHORT_ID_REGEX = re.compile(rf"^[{BASE62_ALPHABET}]{{{SHORT_ID_LENGTH}}}$")

SHORT_ID_ERROR = f"shortId must be a {SHORT_ID_LENGTH}-character base62 string"


class Spec(BaseModel):
    id: str
    title: str
    shortId: str
    summary: str
    category: str
    tags: List[str]
    author: str
    createdAt: datetime
    updatedAt: datetime
    contentMd: str = Field(..., alias="contentMd")

    class Config:
        allow_population_by_field_name = True

    @validator("shortId")
    def validate_short_id(cls, value: str) -> str:
        if not SHORT_ID_REGEX.fullmatch(value):
            raise ValueError(SHORT_ID_ERROR)
        return value


class SpecSummary(BaseModel):
    id: str
    title: str
    shortId: str
    summary: str
    category: str
    tags: List[str]
    author: str
    createdAt: datetime
    updatedAt: datetime

    @validator("shortId")
    def validate_short_id(cls, value: str) -> str:
        if not SHORT_ID_REGEX.fullmatch(value):
            raise ValueError(SHORT_ID_ERROR)
        return value


class PaginatedSpecs(BaseModel):
    total: int
    page: int
    pageSize: int
    items: List[SpecSummary]

    @validator("page", "pageSize", pre=True)
    def positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("must be positive")
        return v


class Category(BaseModel):
    name: str
    slug: str
    count: int


class Tag(Category):
    pass


class UploadPayload(BaseModel):
    title: str
    category: str
    summary: str
    tags: List[str]
    author: str
    shortId: Optional[str] = None

    @validator("shortId")
    def validate_optional_short_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not SHORT_ID_REGEX.fullmatch(value):
            raise ValueError(SHORT_ID_ERROR)
        return value


class UpdatePayload(BaseModel):
    shortId: str
    title: str
    summary: str
    category: str
    tags: List[str]
    author: str
    contentMd: str

    @validator("shortId")
    def validate_short_id(cls, value: str) -> str:
        if not SHORT_ID_REGEX.fullmatch(value):
            raise ValueError(SHORT_ID_ERROR)
        return value

    @validator("contentMd")
    def validate_content(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("contentMd must not be empty")
        return value


class APIResponse(BaseModel):
    status_code: int
    status_msg: str
    data: Dict[str, Any]

    @classmethod
    def success(cls, data: Optional[Dict[str, Any]] = None) -> "APIResponse":
        return cls(
            status_code=BusinessErrorCode.SUCCESS.value,
            status_msg=BusinessErrorCode.SUCCESS.default_message,
            data=data or {},
        )

    @classmethod
    def from_error(
        cls,
        code: BusinessErrorCode,
        message: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> "APIResponse":
        return cls(
            status_code=code.value,
            status_msg=message or code.default_message,
            data=data or {},
        )


def spec_to_document(spec: Spec) -> Dict[str, Any]:
    """Serialize a Spec for Mongo persistence."""

    return {
        "shortId": spec.shortId,
        "title": spec.title,
        "summary": spec.summary,
        "category": spec.category,
        "tags": list(spec.tags),
        "author": spec.author,
        "contentMd": spec.contentMd,
        "createdAt": spec.createdAt,
        "updatedAt": spec.updatedAt,
    }

