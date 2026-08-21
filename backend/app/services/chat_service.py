"""Document-grounded chat service using stored analysis clauses as retrieval context."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.chat_agent import build_chat_prompt
from app.models.clause import Clause
from app.models.document import Document
from app.repositories.chat_repository import ChatRepository
from app.services.llm_providers.groq_client import GroqClassificationError, generate

# Compact retrieval keeps a chat answer fast and avoids spending tokens on
# clauses that are only weakly related to the user's question.
_MAX_CONTEXT_CLAUSES = 4
_MAX_CLAUSE_CHARS = 400
_STOP_WORDS = {
    "a", "an", "and", "are", "at", "be", "can", "do", "for", "from", "how", "i", "in", "is",
    "it", "my", "of", "on", "or", "the", "this", "to", "what", "with", "you", "your",
}
_RESPONSE_LANGUAGES = {
    "en": "English", "hi": "Hindi", "gu": "Gujarati", "es": "Spanish", "fr": "French",
}


class ChatService:
    """Owns authorization, lexical retrieval, LLM generation, and chat persistence."""

    def __init__(self, db: Session):
        self.db = db
        self.repository = ChatRepository(db)

    @staticmethod
    def _utc_iso(value: datetime) -> str:
        """Old database rows are UTC but timezone-naive; mark them for browsers."""
        return value.replace(tzinfo=timezone.utc).isoformat() if value.tzinfo is None else value.isoformat()

    @staticmethod
    def _serialize_session(session) -> dict:
        return {
            "id": session.id,
            "document_id": session.document_id,
            "title": session.title,
            "created_at": ChatService._utc_iso(session.created_at),
            "updated_at": ChatService._utc_iso(session.updated_at),
        }

    @staticmethod
    def _serialize_message(message) -> dict:
        return {
            "id": message.id,
            "role": message.role,
            "message": message.message,
            "sources": message.sources or [],
            "created_at": ChatService._utc_iso(message.created_at),
        }

    def _get_document(self, user_id: int, document_id: str) -> Document:
        document = (
            self.db.query(Document)
            .filter(Document.id == document_id, Document.user_id == user_id)
            .first()
        )
        if not document:
            raise FileNotFoundError("Document not found.")
        return document

    def create_session(self, user_id: int, document_id: str, title: str | None = None) -> dict:
        self._get_document(user_id, document_id)
        session = self.repository.create_session(
            user_id=user_id,
            document_id=document_id,
            title=(title or "New document conversation").strip()[:255],
        )
        self.db.commit()
        self.db.refresh(session)
        return self._serialize_session(session)

    def list_sessions(self, user_id: int, document_id: str | None = None) -> list[dict]:
        if document_id:
            self._get_document(user_id, document_id)
        return [self._serialize_session(session) for session in self.repository.list_sessions(user_id, document_id)]

    def list_messages(self, user_id: int, session_id: str) -> list[dict]:
        session = self.repository.get_session(user_id, session_id)
        if not session:
            raise FileNotFoundError("Chat session not found.")
        return [self._serialize_message(message) for message in self.repository.list_messages(session_id)]

    def rename_session(self, user_id: int, session_id: str, title: str) -> dict:
        session = self.repository.get_session(user_id, session_id)
        if not session:
            raise FileNotFoundError("Chat session not found.")
        session.title = title.strip()
        session.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(session)
        return self._serialize_session(session)

    def delete_session(self, user_id: int, session_id: str) -> None:
        session = self.repository.get_session(user_id, session_id)
        if not session:
            raise FileNotFoundError("Chat session not found.")
        self.repository.delete_session(session)
        self.db.commit()

    @staticmethod
    def _terms(text: str) -> set[str]:
        return {
            word for word in re.findall(r"[a-zA-Z0-9]{3,}", text.lower())
            if word not in _STOP_WORDS
        }

    def _retrieve_clauses(self, document_id: str, question: str) -> list[Clause]:
        """Use transparent lexical retrieval until a vector index is introduced."""
        question_terms = self._terms(question)
        clauses = (
            self.db.query(Clause)
            .filter(Clause.document_id == document_id)
            .order_by(Clause.risk_score.desc(), Clause.sort_order.asc())
            .all()
        )
        if not clauses:
            return []

        def score(clause: Clause) -> tuple[int, int]:
            clause_terms = self._terms(" ".join(filter(None, [
                clause.title,
                clause.original_text,
                clause.plain_english,
                clause.risk_reason,
                clause.negotiation_suggestion,
            ])))
            return (len(question_terms & clause_terms), clause.risk_score)

        ranked = sorted(clauses, key=score, reverse=True)
        # For non-Latin questions (for example Hindi or Gujarati), lexical English
        # matching cannot find a clause. Give the LLM the highest-priority clauses
        # so it can understand the multilingual question without a second translate call.
        relevant = [clause for clause in ranked if score(clause)[0] > 0]
        if not relevant and any(ord(character) > 127 for character in question):
            return ranked[:_MAX_CONTEXT_CLAUSES]
        # No English keyword match means this is better handled as a general
        # legal-term question than by forcing unrelated clauses into the answer.
        return relevant[:_MAX_CONTEXT_CLAUSES]

    @staticmethod
    def _context(clauses: list[Clause]) -> str:
        return "\n\n".join(
            f"[Clause {clause.clause_number}: {clause.title}; page {clause.page_number or 'unknown'}; "
            f"risk {clause.risk_level}]\n{(clause.original_text or clause.plain_english or '')[:_MAX_CLAUSE_CHARS]}"
            for clause in clauses
        )

    @staticmethod
    def _sources(clauses: list[Clause]) -> list[dict]:
        return [
            {
                "clause_id": clause.id,
                "title": clause.title,
                "page": clause.page_number,
                "risk_level": clause.risk_level,
            }
            for clause in clauses
        ]

    def ask(self, user_id: int, session_id: str, question: str, response_language: str = "en") -> dict:
        session = self.repository.get_session(user_id, session_id)
        if not session:
            raise FileNotFoundError("Chat session not found.")
        document = self._get_document(user_id, session.document_id)
        question = question.strip()
        response_language_name = _RESPONSE_LANGUAGES.get(response_language, "English")
        clauses = self._retrieve_clauses(document.id, question)

        self.repository.add_message(session.id, "user", question)
        try:
            answer = generate(
                build_chat_prompt(
                    question=question,
                    document_name=document.original_filename,
                    clause_context=self._context(clauses),
                    document_grounded=bool(clauses),
                    response_language_name=response_language_name,
                ),
                temperature=0.2,
                max_completion_tokens=280,
            ).strip()
        except GroqClassificationError:
            self.db.rollback()
            raise
        sources = self._sources(clauses)

        if session.title == "New document conversation":
            session.title = question[:80]
        session.updated_at = datetime.utcnow()
        assistant_message = self.repository.add_message(session.id, "assistant", answer, sources)
        self.db.commit()
        self.db.refresh(assistant_message)
        return self._serialize_message(assistant_message)
