import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import engine
from app.database.base import Base
from app.config import settings
from app.database.init_db import init_db

# Import API routers.
from app.api.auth import router as auth_router
from app.api.upload import router as upload_router

from app.api.dashboard import router as dashboard_router



PROFILE_UPLOAD_DIRECTORY = str(settings.UPLOAD_DIR / "profile")
os.makedirs(PROFILE_UPLOAD_DIRECTORY, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Run application startup initialization.
    """

    # Fine for development. Use Alembic migrations in production.
    init_db()

    yield


app = FastAPI(
    title="LegalLens API",
    description="AI Powered Contract Analysis Backend",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(dashboard_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",

        # Include this only when opening the frontend using this address.
        "http://192.168.106.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API routes
app.include_router(auth_router)
app.include_router(upload_router)


# Static uploaded files
app.mount(
    "/uploads/profile",
    StaticFiles(directory=PROFILE_UPLOAD_DIRECTORY),
    name="profile-uploads",
)


@app.get("/")
def home():
    return {"message": "LegalLens Backend Running"}
