import asyncio

from fastapi_mail import FastMail
from fastapi_mail import MessageSchema
from fastapi_mail import ConnectionConfig
from fastapi_mail import MessageType
from app.config import settings

class EmailDeliveryError(RuntimeError):
    """Raised when password-reset mail has not been configured or cannot be sent."""

    pass

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

    # Individual SMTP connection/read operations must complete quickly.
    TIMEOUT=min(settings.MAIL_SEND_TIMEOUT_SECONDS, 15),

    # `BASE_DIR` is the backend folder; email templates live under app/templates.
    TEMPLATE_FOLDER=settings.BASE_DIR / "app" / "templates"

)


async def send_reset_email(
    email: str,
    full_name: str,
    reset_link: str
):

    if not all((settings.MAIL_SERVER, settings.MAIL_USERNAME, settings.MAIL_PASSWORD, settings.MAIL_FROM)):
        raise EmailDeliveryError(
            "Email delivery is not configured. Add MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM to backend/.env."
        )

    message = MessageSchema(

        subject="Reset Your Password",

        recipients=[email],

        template_body={
            "name": full_name,
            "reset_link": reset_link
        },

        subtype=MessageType.html

    )

    try:
        # The user still waits for the SMTP provider to accept the message. Run
        # the SMTP coroutine on a worker thread, however, so a DNS/TLS stall
        # cannot freeze FastAPI's single event loop or CORS preflight requests.
        await asyncio.wait_for(
            asyncio.to_thread(_send_message, message),
            timeout=settings.MAIL_SEND_TIMEOUT_SECONDS,
        )
    except TimeoutError as error:
        raise EmailDeliveryError(
            "The email server is taking too long to respond. Please try again in a moment."
        ) from error
    except Exception as error:
        raise EmailDeliveryError("We could not send the password-reset email. Please try again later.") from error


def _send_message(message: MessageSchema) -> None:
    """Run FastMail in a dedicated event loop without blocking the API loop."""
    asyncio.run(FastMail(conf).send_message(message, template_name="forget_password.html"))
