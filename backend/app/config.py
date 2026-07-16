from dotenv import load_dotenv
import os

load_dotenv()

class Settings:

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")

    # JWT
    SECRET_KEY = os.getenv("SECRET_KEY")
    ALGORITHM = os.getenv("ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    )
    REFRESH_TOKEN_EXPIRE_DAYS = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7)
    )

    # Mail
    MAIL_SERVER = os.getenv("MAIL_SERVER")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_FROM = os.getenv("MAIL_FROM")
    MAIL_TLS = os.getenv("MAIL_TLS", "True") == "True"
    MAIL_SSL = os.getenv("MAIL_SSL", "False") == "True"


settings = Settings()