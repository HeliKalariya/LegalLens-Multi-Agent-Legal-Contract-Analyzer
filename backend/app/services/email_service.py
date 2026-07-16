from fastapi_mail import FastMail
from fastapi_mail import MessageSchema
from fastapi_mail import ConnectionConfig
from fastapi_mail import MessageType
from pathlib import Path
from app.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent

print("BASE_DIR:", BASE_DIR)
print("TEMPLATE:", BASE_DIR / "templates")

conf = ConnectionConfig(

    MAIL_USERNAME=settings.MAIL_USERNAME,

    MAIL_PASSWORD=settings.MAIL_PASSWORD,

    MAIL_FROM=settings.MAIL_FROM,

    MAIL_PORT=settings.MAIL_PORT,

    MAIL_SERVER=settings.MAIL_SERVER,

    MAIL_STARTTLS=settings.MAIL_TLS,

    MAIL_SSL_TLS=settings.MAIL_SSL,

    USE_CREDENTIALS=True,

    VALIDATE_CERTS=True,

    TEMPLATE_FOLDER="app/templates"

)


async def send_reset_email(
    email: str,
    full_name: str,
    reset_link: str
):

    message = MessageSchema(

        subject="Reset Your Password",

        recipients=[email],

        template_body={
            "name": full_name,
            "reset_link": reset_link
        },

        subtype=MessageType.html

    )

    fm = FastMail(conf)

    await fm.send_message(
        message,
        template_name="forget_password.html"
    )