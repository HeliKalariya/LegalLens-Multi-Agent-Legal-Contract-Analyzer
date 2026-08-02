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

# Import API routers
from app.api.upload import router as upload_router

from app.database.init_db import init_db

from app.api.profile import router as profile_router

from fastapi.staticfiles import StaticFiles

import os

app = FastAPI(
    title="LegalLens API"
)


@app.on_event("startup")
def startup():

    init_db()


app.include_router(auth_router)

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
    
app.include_router(profile_router)

os.makedirs("uploads/profile", exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)