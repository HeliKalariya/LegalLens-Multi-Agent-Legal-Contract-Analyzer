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

    message = MessageSchema(

        subject="Reset Your Password",

        recipients=[email],

        template_body={
            "name": full_name,
            "reset_link": reset_link
        },

        subtype=MessageType.html

    )

    await _deliver(message, "forget_password.html")


async def send_verification_email(email: str, full_name: str, verification_code: str):
    """Send the registration code required before password login is enabled."""
    message = MessageSchema(
        subject="Verify your LegalLens email",
        recipients=[email],
        template_body={"name": full_name, "verification_code": verification_code},
        subtype=MessageType.html,
    )
    await _deliver(message, "verify_email.html")


async def _deliver(message: MessageSchema, template_name: str) -> None:
    if not all((settings.MAIL_SERVER, settings.MAIL_USERNAME, settings.MAIL_PASSWORD, settings.MAIL_FROM)):
        raise EmailDeliveryError(
            "Email delivery is not configured. Add MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM to backend/.env."
        )

    try:
        # The user still waits for the SMTP provider to accept the message. Run
        # the SMTP coroutine on a worker thread, however, so a DNS/TLS stall
        # cannot freeze FastAPI's single event loop or CORS preflight requests.
        await asyncio.wait_for(
            asyncio.to_thread(_send_message, message, template_name),
            timeout=settings.MAIL_SEND_TIMEOUT_SECONDS,
        )
    except TimeoutError as error:
        raise EmailDeliveryError(
            "The email server is taking too long to respond. Please try again in a moment."
        ) from error
    except Exception as error:
        raise EmailDeliveryError("We could not send the email. Please try again later.") from error


def _send_message(message: MessageSchema, template_name: str) -> None:
    """Run FastMail in a dedicated event loop without blocking the API loop."""
    asyncio.run(FastMail(conf).send_message(message, template_name=template_name))
