import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Tuple, Dict, Any
import httpx
from app.core.config import settings
from app.core.logging import logger


def mask_email(email: str) -> str:
    """Mask email for privacy in logs (e.g. j***@example.com)."""
    if not email or "@" not in email:
        return "***"
    parts = email.split("@", 1)
    user, domain = parts[0], parts[1]
    if len(user) <= 2:
        masked_user = user[0] + "*"
    else:
        masked_user = user[:2] + "*" * (len(user) - 2)
    return f"{masked_user}@{domain}"


def get_otp_email_content(display_name: str, otp: str, expires_in_minutes: int) -> Tuple[str, str]:
    """Generates consistent branded plaintext and HTML email bodies for ReValue OTP verification."""
    subject = f"{otp} is your ReValue verification code"

    text_content = (
        f"Hello {display_name},\n\n"
        f"Thank you for registering on ReValue!\n\n"
        f"Your one-time verification code is:\n"
        f"    {otp}\n\n"
        f"This code is valid for {expires_in_minutes} minutes. "
        f"Never share this code with anyone.\n\n"
        f"If you did not attempt to register on ReValue, please ignore this email.\n\n"
        f"Best regards,\n"
        f"The ReValue Team\n"
        f"https://revalue.market\n"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }}
    .email-container {{
      max-width: 520px;
      margin: 32px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 28px 24px;
      text-align: center;
      border-bottom: 3px solid #059669;
    }}
    .brand-title {{
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
    }}
    .brand-accent {{
      color: #10b981;
    }}
    .brand-tagline {{
      margin: 6px 0 0 0;
      font-size: 12px;
      color: #94a3b8;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }}
    .content {{
      padding: 32px 28px;
    }}
    .greeting {{
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 12px 0;
    }}
    .lead-text {{
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 24px 0;
    }}
    .otp-box {{
      background: #f0fdf4;
      border: 2px dashed #059669;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin: 0 0 24px 0;
    }}
    .otp-label {{
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #047857;
      margin: 0 0 8px 0;
    }}
    .otp-code {{
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #065f46;
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      margin: 0;
      padding-left: 8px;
    }}
    .otp-meta {{
      margin: 10px 0 0 0;
      font-size: 12px;
      color: #047857;
      font-weight: 500;
    }}
    .notice-card {{
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 0 0 24px 0;
    }}
    .notice-text {{
      margin: 0;
      font-size: 12px;
      line-height: 1.5;
      color: #92400e;
    }}
    .footer {{
      background: #f8fafc;
      padding: 20px 24px;
      border-top: 1px solid #f1f5f9;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1 class="brand-title">Re<span class="brand-accent">Value</span></h1>
      <p class="brand-tagline">Pre-Owned Smartphone Marketplace</p>
    </div>
    <div class="content">
      <p class="greeting">Hello {display_name},</p>
      <p class="lead-text">
        Thank you for choosing ReValue. To verify your email address and activate your account, please enter the verification code below:
      </p>
      <div class="otp-box">
        <div class="otp-label">Verification Code (OTP)</div>
        <div class="otp-code">{otp}</div>
        <p class="otp-meta">&#9201; Expires in {expires_in_minutes} minutes</p>
      </div>
      <div class="notice-card">
        <p class="notice-text">
          <strong>Security Notice:</strong> ReValue representatives will never ask for your verification code. Never share this code with anyone. If you did not create an account on ReValue, you can safely ignore this email.
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">&copy; {settings.SMTP_FROM_NAME} &bull; All rights reserved.</p>
      <p style="margin: 0;">Automated message sent by ReValue. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>"""

    return text_content, html_content


class AppsScriptEmailProvider:
    """
    Google Apps Script HTTPS email gateway adapter.
    Dispatches transactional registration OTP emails over standard HTTPS (Port 443),
    bypassing outbound SMTP port blocks on cloud hosting providers like Render Free.
    """

    @staticmethod
    def send_otp(email: str, name: str, otp: str) -> Tuple[bool, Optional[str]]:
        masked = mask_email(email)
        url = settings.APPS_SCRIPT_EMAIL_URL
        secret = settings.APPS_SCRIPT_SHARED_SECRET

        if not settings.APPS_SCRIPT_EMAIL_ENABLED:
            return False, "Google Apps Script email provider is disabled (APPS_SCRIPT_EMAIL_ENABLED=false)."

        if not url or not secret:
            err_msg = "Google Apps Script email gateway is incompletely configured (missing URL or shared secret)."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
            return False, err_msg

        payload = {
            "action": "send_otp",
            "shared_secret": secret,
            "email": email.strip(),
            "name": (name or "").strip()[:100],
            "otp": otp.strip(),
            "expires_in_minutes": settings.OTP_EXPIRE_MINUTES,
        }

        try:
            # Google Apps Script Web App responds with a 302 redirect to script.googleusercontent.com
            # follow_redirects=True ensures the client follows the redirect and reads the JSON response
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                response = client.post(
                    url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": "ReValue-Backend/1.0",
                    },
                )

            if response.status_code != 200:
                err_msg = f"Email gateway returned HTTP status {response.status_code}."
                logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
                return False, err_msg

            try:
                data = response.json()
            except Exception:
                err_msg = "Email gateway returned an invalid or non-JSON response."
                logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
                return False, err_msg

            if not isinstance(data, dict):
                err_msg = "Email gateway returned an unexpected response structure."
                logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
                return False, err_msg

            if data.get("success") is True:
                logger.info(f"[AppsScriptEmail] Registration OTP email successfully dispatched to {masked} via Google Apps Script.")
                return True, None

            # Handle structured error response from Google Apps Script
            error_data = data.get("error", {})
            if isinstance(error_data, dict):
                error_code = error_data.get("code", "GATEWAY_ERROR")
                error_message = error_data.get("message", "Email delivery failed at gateway.")
            else:
                error_code = "GATEWAY_ERROR"
                error_message = str(error_data)

            err_msg = f"Email gateway error ({error_code}): {error_message}"
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
            return False, err_msg

        except httpx.TimeoutException:
            err_msg = "Email gateway connection timed out (exceeded 15s)."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
            return False, err_msg
        except httpx.RequestError as req_err:
            err_msg = f"Network connection to email gateway failed: {type(req_err).__name__}."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
            return False, err_msg
        except Exception as ex:
            err_msg = f"Unexpected error while communicating with email gateway: {type(ex).__name__}."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
            return False, err_msg

    @staticmethod
    def send_delivery_otp(
        email: str,
        name: str,
        otp: str,
        order_id: str,
        product_title: Optional[str] = None,
        carrier_name: Optional[str] = None,
        expires_in_hours: int = 48
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatches buyer doorstep delivery verification code via Google Apps Script HTTPS gateway.
        Uses action: 'send_delivery_otp' with order context.
        """
        masked = mask_email(email)
        url = settings.APPS_SCRIPT_EMAIL_URL
        secret = settings.APPS_SCRIPT_SHARED_SECRET

        if not settings.APPS_SCRIPT_EMAIL_ENABLED:
            return False, "Google Apps Script email provider is disabled (APPS_SCRIPT_EMAIL_ENABLED=false)."

        if not url or not secret:
            err_msg = "Google Apps Script email gateway is incompletely configured (missing URL or shared secret)."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked}")
            return False, err_msg

        payload = {
            "action": "send_delivery_otp",
            "shared_secret": secret,
            "email": email.strip(),
            "name": (name or "").strip()[:100],
            "otp": otp.strip(),
            "order_id": order_id.strip()[:64],
            "product_title": (product_title or "").strip()[:120],
            "carrier_name": (carrier_name or "").strip()[:64],
            "expires_in_hours": expires_in_hours,
        }

        try:
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                response = client.post(
                    url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": "ReValue-Backend/1.0",
                    },
                )

            if response.status_code != 200:
                err_msg = f"Email gateway returned HTTP status {response.status_code}."
                logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
                return False, err_msg

            try:
                data = response.json()
            except Exception:
                err_msg = "Email gateway returned an invalid or non-JSON response."
                logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
                return False, err_msg

            if not isinstance(data, dict):
                err_msg = "Email gateway returned an unexpected response structure."
                logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
                return False, err_msg

            if data.get("success") is True:
                logger.info(f"[AppsScriptEmail] Delivery OTP email successfully dispatched to {masked} for order {order_id} via Google Apps Script.")
                return True, None

            # Handle structured error response from Google Apps Script
            error_data = data.get("error", {})
            if isinstance(error_data, dict):
                error_code = error_data.get("code", "GATEWAY_ERROR")
                error_message = error_data.get("message", "Email delivery failed at gateway.")
            else:
                error_code = "GATEWAY_ERROR"
                error_message = str(error_data)

            err_msg = f"Email gateway error ({error_code}): {error_message}"
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
            return False, err_msg

        except httpx.TimeoutException:
            err_msg = "Email gateway connection timed out (exceeded 15s)."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
            return False, err_msg
        except httpx.RequestError as req_err:
            err_msg = f"Network connection to email gateway failed: {type(req_err).__name__}."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
            return False, err_msg
        except Exception as ex:
            err_msg = f"Unexpected error while communicating with email gateway: {type(ex).__name__}."
            logger.error(f"[AppsScriptEmail] {err_msg} Target: {masked} Order: {order_id}")
            return False, err_msg

    @staticmethod
    def ping() -> Tuple[bool, Optional[str]]:
        """Health-check ping to verify Apps Script connectivity and shared secret without sending an email."""
        url = settings.APPS_SCRIPT_EMAIL_URL
        secret = settings.APPS_SCRIPT_SHARED_SECRET

        if not url or not secret:
            return False, "Google Apps Script email gateway is not configured."

        payload = {
            "action": "ping",
            "shared_secret": secret,
        }

        try:
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                response = client.post(
                    url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": "ReValue-Backend/1.0",
                    },
                )
            if response.status_code != 200:
                return False, f"Gateway returned HTTP {response.status_code}."
            data = response.json()
            if data.get("success") is True:
                return True, None
            error_msg = data.get("error", {}).get("message", "Ping failed.")
            return False, error_msg
        except Exception as e:
            return False, str(e)


class SmtpEmailProvider:
    """
    Standard SMTP provider connecting directly to Gmail SMTP (smtp.gmail.com).
    Intended for local development or paid cloud hosting instances where outbound ports 587/465 are unblocked.
    """

    @staticmethod
    def send_otp(email: str, name: str, otp: str) -> Tuple[bool, Optional[str]]:
        masked = mask_email(email)

        smtp_host = settings.effective_smtp_host
        configured_port = settings.SMTP_PORT
        smtp_user = settings.effective_smtp_username
        raw_password = settings.SMTP_PASSWORD
        # Strip spaces from 16-character Google App Password (e.g. 'abcd efgh ijkl mnop' -> 'abcdefghijklmnop')
        smtp_password = raw_password.replace(" ", "").strip() if raw_password else None
        sender_email = settings.effective_email_from
        sender_name = settings.SMTP_FROM_NAME or "ReValue Marketplace"

        subject = f"{otp} is your ReValue verification code"

        # Construct MIME Message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender_email}>"
        msg["To"] = email

        display_name = name.strip() if name else "ReValue User"
        text_content, html_content = get_otp_email_content(display_name, otp, settings.OTP_EXPIRE_MINUTES)

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        timeout_sec = 10

        def _attempt_send(port: int, use_ssl: bool) -> Tuple[bool, Optional[str]]:
            try:
                if use_ssl:
                    with smtplib.SMTP_SSL(smtp_host, port, timeout=timeout_sec) as server:
                        if smtp_user and smtp_password:
                            server.login(smtp_user, smtp_password)
                        server.sendmail(sender_email, [email], msg.as_string())
                else:
                    with smtplib.SMTP(smtp_host, port, timeout=timeout_sec) as server:
                        server.ehlo()
                        if server.has_extn("STARTTLS") or server.has_extn("starttls"):
                            server.starttls()
                            server.ehlo()
                        if smtp_user and smtp_password:
                            server.login(smtp_user, smtp_password)
                        server.sendmail(sender_email, [email], msg.as_string())
                return True, None
            except smtplib.SMTPAuthenticationError as auth_err:
                err_detail = f"Authentication rejected by Gmail (code {auth_err.smtp_code}). Please verify your 16-character Google App Password."
                logger.error(f"[SmtpEmail] {err_detail} Target: {masked}")
                return False, err_detail
            except (socket.timeout, smtplib.SMTPConnectError, ConnectionRefusedError, OSError) as net_err:
                err_detail = f"Network connection failed on {smtp_host}:{port} ({type(net_err).__name__})."
                logger.warning(f"[SmtpEmail] {err_detail} Target: {masked}")
                return False, err_detail
            except Exception as ex:
                err_detail = f"Delivery failed on port {port}: {type(ex).__name__}."
                logger.error(f"[SmtpEmail] {err_detail} Target: {masked}")
                return False, err_detail

        # Primary attempt based on configured port
        use_ssl_primary = (configured_port == 465)
        success, err = _attempt_send(configured_port, use_ssl_primary)
        if success:
            logger.info(f"[SmtpEmail] Registration OTP successfully delivered to {masked} via port {configured_port}")
            return True, None

        # If primary failed with auth error, do not retry other ports because credentials are bad
        if err and "Authentication rejected" in err:
            return False, err

        # Resilient fallback: If port 587 failed due to network/firewall, try port 465 SSL
        if configured_port != 465:
            logger.info(f"[SmtpEmail] Attempting SSL fallback on port 465 for {masked}...")
            fallback_success, fallback_err = _attempt_send(465, True)
            if fallback_success:
                logger.info(f"[SmtpEmail] Registration OTP successfully delivered to {masked} via fallback port 465")
                return True, None
            return False, f"Primary ({err}) and fallback ({fallback_err}) failed."

        return False, err


class EmailService:
    @staticmethod
    def send_registration_otp(email: str, name: str, otp: str) -> Tuple[bool, Optional[str]]:
        """
        Routes registration OTP email through the appropriate provider:
        1. Google Apps Script HTTPS Gateway (Primary for Render Free & cloud HTTPS environments).
        2. Gmail SMTP (Supported in local development or paid instances; prevented on Render Free).
        3. Local simulation (Development only; never in production).
        """
        masked = mask_email(email)

        # 1. Google Apps Script HTTPS Gateway (Primary for Render Free)
        if settings.is_apps_script_configured:
            return AppsScriptEmailProvider.send_otp(email, name, otp)

        # 2. Gmail SMTP / Generic SMTP
        if settings.is_smtp_configured:
            if settings.is_production:
                err_msg = (
                    "Direct outbound SMTP (ports 25, 465, 587) is blocked on Render Free Tier. "
                    "Please configure Google Apps Script (APPS_SCRIPT_EMAIL_ENABLED, APPS_SCRIPT_EMAIL_URL, APPS_SCRIPT_SHARED_SECRET)."
                )
                logger.error(f"[EmailService] {err_msg}")
                return False, err_msg
            return SmtpEmailProvider.send_otp(email, name, otp)

        # 3. Development Simulation or Production Error
        if settings.is_production:
            err_msg = "No email delivery provider is configured in production."
            logger.error(f"[EmailService] {err_msg} Cannot deliver OTP to {masked}.")
            return False, err_msg

        logger.info(
            f"[EmailService] No email provider configured. "
            f"Registration OTP delivery simulated for {masked}."
        )
        return True, None

    @staticmethod
    def send_delivery_otp(
        email: str,
        name: str,
        otp: str,
        order_id: str,
        product_title: Optional[str] = None,
        carrier_name: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatches order-specific doorstep delivery verification OTP email to authenticated buyer:
        1. Google Apps Script HTTPS Gateway (Primary for Render Free & cloud HTTPS environments).
        2. Local simulation (Development only; never in production).
        """
        masked = mask_email(email)

        # 1. Google Apps Script HTTPS Gateway (Primary)
        if settings.is_apps_script_configured:
            return AppsScriptEmailProvider.send_delivery_otp(
                email=email,
                name=name,
                otp=otp,
                order_id=order_id,
                product_title=product_title,
                carrier_name=carrier_name,
                expires_in_hours=48,
            )

        # 2. Production check: If in production without Apps Script, fail explicitly
        if settings.is_production:
            err_msg = "No email delivery provider is configured in production for delivery OTP."
            logger.error(f"[EmailService] {err_msg} Cannot deliver OTP to {masked} for order {order_id}.")
            return False, err_msg

        # 3. Development Simulation
        logger.info(
            f"[EmailService] Delivery OTP email simulated for {masked} (Order: {order_id})."
        )
        return True, None
