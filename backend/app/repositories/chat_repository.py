"""Database access helpers for chat sessions and messages."""

from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, ChatSession


class ChatRepository:
    """Keeps chat persistence queries out of the API layer."""

    def __init__(self, db: Session):
        self.db = db

    def create_session(self, user_id: int, document_id: str, title: str) -> ChatSession:
        session = ChatSession(user_id=user_id, document_id=document_id, title=title)
        self.db.add(session)
        self.db.flush()
        return session

    def list_sessions(self, user_id: int, document_id: str | None = None) -> list[ChatSession]:
        query = self.db.query(ChatSession).filter(ChatSession.user_id == user_id)
        if document_id:
            query = query.filter(ChatSession.document_id == document_id)
        return query.order_by(ChatSession.updated_at.desc()).all()

    def get_session(self, user_id: int, session_id: str) -> ChatSession | None:
        return (
            self.db.query(ChatSession)
            .filter(ChatSession.id == session_id, ChatSession.user_id == user_id)
            .first()
        )

    def delete_session(self, session: ChatSession) -> None:
        self.db.delete(session)

    def list_messages(self, session_id: str) -> list[ChatMessage]:
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )

    def add_message(self, session_id: str, role: str, message: str, sources: list[dict] | None = None) -> ChatMessage:
        chat_message = ChatMessage(
            session_id=session_id,
            role=role,
            message=message,
            sources=sources or [],
        )
        self.db.add(chat_message)
        self.db.flush()
        return chat_message
