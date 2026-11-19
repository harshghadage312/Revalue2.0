import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
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


class EmailService:
    @staticmethod
    def send_registration_otp(email: str, name: str, otp: str) -> bool:
        """
        Sends a 6-digit registration OTP verification email via Gmail SMTP (or configured SMTP).
        Supports STARTTLS (port 587) and SSL (port 465).
        Returns True if sent or simulated successfully; returns False on delivery failure.
        """
        masked = mask_email(email)

        if not settings.is_smtp_configured:
            if settings.ENVIRONMENT == "production":
                logger.error(
                    f"[EmailService] FATAL: SMTP is not configured or disabled in production mode. "
                    f"Cannot send registration OTP to {masked}."
                )
                return False
            logger.info(
                f"[EmailService] SMTP not configured or disabled (SMTP_ENABLED={settings.SMTP_ENABLED}). "
                f"Registration OTP delivery simulated for {masked}."
            )
            return True

        smtp_host = settings.effective_smtp_host
        smtp_port = settings.SMTP_PORT
        smtp_user = settings.effective_smtp_username
        smtp_password = settings.SMTP_PASSWORD
        sender_email = settings.effective_email_from
        sender_name = settings.SMTP_FROM_NAME or "ReValue Marketplace"

        subject = f"{otp} is your ReValue verification code"

        # Construct MIME Message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{sender_email}>"
        msg["To"] = email

        # Plain text fallback
        display_name = name.strip() if name else "ReValue User"
        text_content = (
            f"Hello {display_name},\n\n"
            f"Thank you for registering on ReValue!\n\n"
            f"Your one-time verification code is:\n"
            f"    {otp}\n\n"
            f"This code is valid for {settings.OTP_EXPIRE_MINUTES} minutes. "
            f"Never share this code with anyone.\n\n"
            f"If you did not attempt to register on ReValue, please ignore this email.\n\n"
            f"Best regards,\n"
            f"The ReValue Team\n"
            f"https://revalue.market\n"
        )

        # High-quality HTML template branded for ReValue
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
      padding-left: 8px; /* offset trailing letter spacing */
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
        <p class="otp-meta">&#9201; Expires in {settings.OTP_EXPIRE_MINUTES} minutes</p>
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

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        timeout_seconds = 12

        try:
            if smtp_port == 465:
                # SSL connection
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=timeout_seconds) as server:
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.sendmail(sender_email, [email], msg.as_string())
            else:
                # Standard STARTTLS connection (typically port 587 or 25)
                with smtplib.SMTP(smtp_host, smtp_port, timeout=timeout_seconds) as server:
                    server.ehlo()
                    # Attempt TLS if supported
                    if server.has_extn("STARTTLS"):
                        server.starttls()
                        server.ehlo()
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.sendmail(sender_email, [email], msg.as_string())

            logger.info(f"[EmailService] Registration OTP successfully delivered to {masked}")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(
                f"[EmailService] SMTP Authentication failed for {masked}. "
                f"Please verify your Gmail App Password in SMTP_PASSWORD. Error: {str(e)}"
            )
            return False
        except (socket.timeout, smtplib.SMTPConnectError) as e:
            logger.error(f"[EmailService] SMTP connection timeout or failed to {smtp_host}:{smtp_port}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"[EmailService] Failed to send OTP email to {masked}: {str(e)}")
            return False
