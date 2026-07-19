from fastapi import FastAPI

from app.api.auth import router as auth_router

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

    return {
        "message": "LegalLens Backend Running"
    }
    
app.include_router(profile_router)

os.makedirs("uploads/profile", exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)