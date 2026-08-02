"""
main.py

This is the entry point of the FastAPI application.

Responsibilities:
1. Create the FastAPI app
2. Configure CORS
3. Register all API routers
4. Start the backend server
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import engine
from app.database.base import Base

# Import all models
from app.models.user import User

# Import API routers
#from app.api.upload import router as upload_router
from app.api.auth import router as auth_router
from app.api.auth import router as auth_router

# Create database tables
Base.metadata.create_all(bind=engine)

# ----------------------------------------------------
# Create FastAPI application
# ----------------------------------------------------
app = FastAPI(
    title="LegalLens API",
    description="AI Powered Contract Analysis Backend",
    version="1.0.0",
)

# ----------------------------------------------------
# Configure CORS
#
# Allows your Next.js frontend to communicate
# with the FastAPI backend.
#
# Change localhost:3000 to your frontend URL
# when deploying.
# ----------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# Register API Routes
#
# Every router added here becomes accessible
# through the backend.
#
# Example:
#
# upload.py
#
# prefix="/api/upload"
#
# POST /api/upload
# ----------------------------------------------------
#app.include_router(upload_router)
app.include_router(auth_router)


# ----------------------------------------------------
# Root Endpoint
#
# Used only to verify that backend is running.
#
# URL:
#
# GET /
# ----------------------------------------------------
@app.get("/")
def home():
    """
    Health Check Endpoint

    Returns a simple response to verify
    that the API server is working.
    """

    return {
        "message": "LegalLens Backend Running Successfully 🚀"
    }