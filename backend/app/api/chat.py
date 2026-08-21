"""Authenticated API for document-grounded chat sessions."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse, ChatSessionCreate, ChatSessionRename, ChatSessionResponse
from app.security.oauth import get_current_user
from app.services.chat_service import ChatService
from app.services.llm_providers.groq_client import GroqClassificationError

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(payload: ChatSessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return ChatService(db).create_session(current_user.id, payload.document_id, payload.title)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/sessions", response_model=list[ChatSessionResponse])
def list_sessions(document_id: str | None = Query(default=None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return ChatService(db).list_sessions(current_user.id, document_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
def list_messages(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return ChatService(db).list_messages(current_user.id, session_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
def rename_session(session_id: str, payload: ChatSessionRename, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return ChatService(db).rename_session(current_user.id, session_id, payload.title)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        ChatService(db).delete_session(current_user.id, session_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
def ask_question(session_id: str, payload: ChatMessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return ChatService(db).ask(current_user.id, session_id, payload.message, payload.response_language)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except GroqClassificationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
