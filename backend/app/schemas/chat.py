"""Request and response contracts for document-grounded chat."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChatSessionCreate(BaseModel):
    """Start a conversation for one document owned by the current user."""

    document_id: str = Field(min_length=1, max_length=36)
    title: str | None = Field(default=None, max_length=255)


class ChatSessionRename(BaseModel):
    """Replace the title of a conversation owned by the current user."""

    title: str = Field(min_length=1, max_length=255)


class ChatMessageCreate(BaseModel):
    """A user question sent within an existing chat session."""

    message: str = Field(min_length=1, max_length=2000)
    # The question can be written in any language; this controls the answer.
    response_language: Literal["en", "hi", "gu", "es", "fr"] = "en"


class ChatSource(BaseModel):
    """A clause used as evidence for an assistant response."""

    clause_id: str
    title: str
    page: int | None = None
    risk_level: str


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    message: str
    sources: list[ChatSource] = Field(default_factory=list)
    created_at: datetime


class ChatSessionResponse(BaseModel):
    id: str
    document_id: str
    title: str
    created_at: datetime
    updated_at: datetime
