from __future__ import annotations

from datetime import datetime
from enum import IntEnum, unique
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


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
    author: str
    createdAt: datetime
    updatedAt: datetime
    contentMd: str = Field(..., alias="contentMd")
    contentHtml: Optional[str] = None
    toc: Optional[List[TocItem]] = None

    class Config:
        allow_population_by_field_name = True


class SpecSummary(BaseModel):
    id: str
    title: str
    slug: str
    summary: str
    category: str
    tags: List[str]
    author: str
    createdAt: datetime
    updatedAt: datetime


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
    author: str


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

