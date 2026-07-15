from fastapi import FastAPI

from app.api.auth import router as auth_router

from app.database.init_db import init_db

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