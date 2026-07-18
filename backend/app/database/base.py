"""Shared SQLAlchemy base class for every database model."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class that gives all models the same SQLAlchemy metadata registry."""

    pass
