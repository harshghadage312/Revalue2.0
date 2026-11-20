import uuid
import pytest
from unittest.mock import patch, MagicMock
import httpx
from starlette.testclient import TestClient

from main import app
from app.db.connection import DatabaseManager, get_db
from app.core.config import settings
from app.services.email_service import AppsScriptEmailProvider, EmailService

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    DatabaseManager.connect(force_memory=True)


def test_apps_script_send_otp_success():
    """Verify that a 200 response with success=True from Apps Script returns (True, None)."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "super_secure_random_shared_secret_12345"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "message": "Verification email dispatched successfully.",
            "timestamp": "2026-11-19T12:00:00.000Z"
        }

        with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
            success, err = AppsScriptEmailProvider.send_otp("aniruddha@example.com", "Aniruddha", "987654")
            assert success is True
            assert err is None
            mock_post.assert_called_once()
            called_kwargs = mock_post.call_args[1]
            payload = called_kwargs["json"]
            assert payload["action"] == "send_otp"
            assert payload["email"] == "aniruddha@example.com"
            assert payload["name"] == "Aniruddha"
            assert payload["otp"] == "987654"
            assert payload["shared_secret"] == "super_secure_random_shared_secret_12345"
            assert payload["expires_in_minutes"] == 5
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_invalid_shared_secret():
    """Verify that an unauthorized response from Apps Script is captured with clear error."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "wrong_secret"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": False,
            "error": {
                "code": "UNAUTHORIZED",
                "message": "Invalid or missing shared secret."
            }
        }

        with patch("httpx.Client.post", return_value=mock_resp):
            success, err = AppsScriptEmailProvider.send_otp("user@example.com", "User", "123456")
            assert success is False
            assert "UNAUTHORIZED" in err
            assert "Invalid or missing shared secret" in err
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_http_timeout():
    """Verify that httpx.TimeoutException is handled gracefully without unhandled crashes."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Read timed out")):
            success, err = AppsScriptEmailProvider.send_otp("user@example.com", "User", "123456")
            assert success is False
            assert "timed out" in err.lower()
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_http_500():
    """Verify that HTTP 500 error from Apps Script gateway is handled gracefully."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        with patch("httpx.Client.post", return_value=mock_resp):
            success, err = AppsScriptEmailProvider.send_otp("user@example.com", "User", "123456")
            assert success is False
            assert "HTTP status 500" in err
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_invalid_json_response():
    """Verify that non-JSON response from Apps Script is safely caught."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.side_effect = ValueError("Invalid JSON string")

        with patch("httpx.Client.post", return_value=mock_resp):
            success, err = AppsScriptEmailProvider.send_otp("user@example.com", "User", "123456")
            assert success is False
            assert "invalid or non-JSON response" in err
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_email_delivery_failure():
    """Verify that delivery errors reported by Apps Script (e.g. quota exceeded) are returned."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": False,
            "error": {
                "code": "DELIVERY_FAILED",
                "message": "Google MailApp failed to dispatch email: Daily quota exceeded."
            }
        }

        with patch("httpx.Client.post", return_value=mock_resp):
            success, err = AppsScriptEmailProvider.send_otp("user@example.com", "User", "123456")
            assert success is False
            assert "DELIVERY_FAILED" in err
            assert "Daily quota exceeded" in err
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_ping():
    """Verify health ping action against Apps Script gateway."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "message": "ReValue Google Apps Script Email Gateway is operational.",
            "timestamp": "2026-11-19T12:00:00.000Z"
        }

        with patch("httpx.Client.post", return_value=mock_resp):
            success, err = AppsScriptEmailProvider.ping()
            assert success is True
            assert err is None
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_production_no_dev_otp_leak_with_apps_script():
    """Verify that in production mode, dev_otp is NEVER returned when Apps Script is active."""
    orig_env = settings.ENVIRONMENT
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.ENVIRONMENT = "production"
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        with patch("app.services.email_service.AppsScriptEmailProvider.send_otp", return_value=(True, None)) as mock_send:
            email = f"prod_gas_{uuid.uuid4().hex[:8]}@example.com"
            payload = {
                "name": "Prod GAS User",
                "email": email,
                "password": "SecurePassword123!",
                "role": "buyer",
            }
            res = client.post("/api/v1/auth/register/send-otp", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert "dev_otp" not in data
            assert data["email"] == email
            assert data["cooldown_seconds"] == 60
            assert data["expires_in_minutes"] == 5
            mock_send.assert_called_once()
    finally:
        settings.ENVIRONMENT = orig_env
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_render_free_blocks_direct_smtp_in_production():
    """Verify that on Render Free in production, direct SMTP is blocked and returns an actionable error."""
    orig_env = settings.ENVIRONMENT
    orig_gas_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_smtp_enabled = settings.SMTP_ENABLED
    orig_smtp_pass = settings.SMTP_PASSWORD
    orig_smtp_user = settings.SMTP_USERNAME

    try:
        settings.ENVIRONMENT = "production"
        settings.APPS_SCRIPT_EMAIL_ENABLED = False
        settings.SMTP_ENABLED = True
        settings.SMTP_USERNAME = "revalue26@gmail.com"
        settings.SMTP_PASSWORD = "app_password"

        success, err = EmailService.send_registration_otp("test@example.com", "Test", "123456")
        assert success is False
        assert "blocked on Render Free Tier" in err
    finally:
        settings.ENVIRONMENT = orig_env
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_gas_enabled
        settings.SMTP_ENABLED = orig_smtp_enabled
        settings.SMTP_PASSWORD = orig_smtp_pass
        settings.SMTP_USERNAME = orig_smtp_user


def test_full_registration_flow_with_apps_script():
    """Complete end-to-end registration flow with Apps Script email dispatch and subsequent OTP verification."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret"

        captured_otp = []

        def capture_send(email, name, otp):
            captured_otp.append(otp)
            return True, None

        with patch("app.services.email_service.AppsScriptEmailProvider.send_otp", side_effect=capture_send):
            email = f"full_flow_{uuid.uuid4().hex[:8]}@example.com"
            payload = {
                "name": "Integration Tester",
                "email": email,
                "password": "Password123!",
                "role": "seller",
            }
            # Step 1: Request OTP
            res1 = client.post("/api/v1/auth/register/send-otp", json=payload)
            assert res1.status_code == 200
            assert len(captured_otp) == 1
            sent_otp = captured_otp[0]
            assert len(sent_otp) == 6
            assert sent_otp.isdigit()

            # Step 2: Verify OTP
            verify_payload = {
                "email": email,
                "otp": sent_otp,
            }
            res2 = client.post("/api/v1/auth/register/verify-otp", json=verify_payload)
            assert res2.status_code == 200
            auth_data = res2.json()
            assert "access_token" in auth_data
            assert auth_data["user"]["email"] == email
            assert auth_data["user"]["role"] == "seller"

            # Step 3: Verify user exists and is active in database
            db = get_db()
            user = db.users.find_one({"email": email})
            assert user is not None
            assert user["is_email_verified"] is True
            assert user["is_active"] is True
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_apps_script_send_password_reset_success():
    """Verify AppsScriptEmailProvider.send_password_reset sends action 'send_password_reset'."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "super_secure_random_shared_secret_12345"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "message": "Password reset email dispatched successfully.",
            "timestamp": "2026-11-20T12:00:00.000Z"
        }

        with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
            success, err = AppsScriptEmailProvider.send_password_reset(
                email="reset_target@example.com",
                name="Target User",
                reset_url="https://revalue-nine.vercel.app/reset-password?token=secret123",
                expires_in_minutes=15
            )
            assert success is True
            assert err is None
            mock_post.assert_called_once()
            called_kwargs = mock_post.call_args[1]
            payload = called_kwargs["json"]
            assert payload["action"] == "send_password_reset"
            assert payload["email"] == "reset_target@example.com"
            assert payload["name"] == "Target User"
            assert "secret123" in payload["reset_url"]
            assert payload["expires_in_minutes"] == 15
            assert payload["shared_secret"] == "super_secure_random_shared_secret_12345"
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


def test_full_forgot_password_flow_with_apps_script():
    """End-to-end integration test of forgot-password requesting email dispatch via Google Apps Script."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "super_secure_random_shared_secret_12345"

        captured_urls = []

        def capture_send(email, name, reset_url, expires_in_minutes=15):
            captured_urls.append(reset_url)
            return True, None

        with patch("app.services.email_service.AppsScriptEmailProvider.send_password_reset", side_effect=capture_send):
            email = f"as_reset_{uuid.uuid4().hex[:8]}@example.com"
            # 1. Register user
            client.post("/api/v1/auth/register", json={
                "name": "AppsScript Reset User",
                "email": email,
                "password": "InitialPass123!",
                "role": "buyer"
            })

            # 2. Request forgot password
            res = client.post("/api/v1/auth/forgot-password", json={"email": email})
            assert res.status_code == 200
            assert res.json()["message"] == "If an account exists with this email, you will receive a password reset link."
            assert len(captured_urls) == 1
            reset_url = captured_urls[0]
            assert "reset-password?token=" in reset_url
            raw_token = reset_url.split("token=")[1]

            # 3. Complete password reset with extracted token
            reset_res = client.post("/api/v1/auth/reset-password", json={
                "token": raw_token,
                "new_password": "NewAppsScriptPassword123!"
            })
            assert reset_res.status_code == 200

            # 4. Login with new password works
            login_res = client.post("/api/v1/auth/login", json={
                "email": email,
                "password": "NewAppsScriptPassword123!"
            })
            assert login_res.status_code == 200
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret
