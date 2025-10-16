from __future__ import annotations

from datetime import datetime
from enum import IntEnum, unique
from typing import List, Optional

from pydantic import BaseModel, Field, validator


@unique
class BusinessErrorCode(IntEnum):
    INVALID_ARG = 1001
    NOT_FOUND = 1004
    UNAUTHORIZED = 1003
    INTERNAL = 1500

    @property
    def default_message(self) -> str:
        return _ERROR_MESSAGES[self]


_ERROR_MESSAGES = {
    BusinessErrorCode.INVALID_ARG: "Invalid argument",
    BusinessErrorCode.NOT_FOUND: "Resource not found",
    BusinessErrorCode.UNAUTHORIZED: "Unauthorized",
    BusinessErrorCode.INTERNAL: "Internal server error",
}


class TocItem(BaseModel):
    text: str
    id: str
    level: int


class Spec(BaseModel):
    id: str
    title: str
    slug: str
    summary: str
    category: str
    tags: List[str]
    contentMd: str = Field(..., alias="contentMd")
    contentHtml: Optional[str] = None
    toc: Optional[List[TocItem]] = None
    updatedAt: datetime
    version: int

    class Config:
        allow_population_by_field_name = True


class SpecSummary(BaseModel):
    id: str
    title: str
    slug: str
    summary: str
    category: str
    tags: List[str]
    updatedAt: datetime
    version: int


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
    slug: str
    category: str
    summary: str
    tags: List[str]
    version: int = 1

