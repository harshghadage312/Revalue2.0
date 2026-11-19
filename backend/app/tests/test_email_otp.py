import pytest
import uuid
from datetime import datetime, timezone, timedelta
from starlette.testclient import TestClient
from app.db.connection import DatabaseManager, get_db
from app.core.security import hash_password
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    DatabaseManager.connect(force_memory=True)


def test_send_otp_success():
    email = f"otp_test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Priya Sharma",
        "email": email,
        "password": "SecurePassword123!",
        "role": "buyer",
    }
    res = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == email
    assert data["cooldown_seconds"] == 60
    assert data["expires_in_minutes"] == 5
    assert "dev_otp" in data
    assert len(data["dev_otp"]) == 6
    assert data["dev_otp"].isdigit()

    # Check MongoDB zero-plaintext guarantee
    db = get_db()
    record = db.email_verifications.find_one({"email": email})
    assert record is not None
    assert record["name"] == "Priya Sharma"
    assert record["role"] == "buyer"
    # Plaintext OTP must NOT be stored
    assert "otp" not in record
    assert "otp_hash" in record
    assert record["otp_hash"] != data["dev_otp"]
    # Plaintext password must NOT be stored
    assert "password" not in record
    assert "password_hash" in record
    assert record["password_hash"] != "SecurePassword123!"


def test_send_otp_cooldown_enforced():
    email = f"cooldown_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Cooldown Tester",
        "email": email,
        "password": "SecurePassword123!",
        "role": "seller",
    }
    res1 = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res1.status_code == 200

    # Immediate second request should be blocked by 60s cooldown
    res2 = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res2.status_code == 422
    assert "seconds before requesting a new verification code" in res2.json()["error"]["message"]


def test_send_otp_disallows_rider_self_registration():
    email = f"rider_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Rider Attempt",
        "email": email,
        "password": "SecurePassword123!",
        "role": "rider",
    }
    res = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "REQUEST_VALIDATION_ERROR"


def test_send_otp_existing_verified_user_conflict():
    db = get_db()
    email = f"existing_{uuid.uuid4().hex[:8]}@example.com"
    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "name": "Existing User",
        "email": email,
        "password_hash": hash_password("Password123!"),
        "role": "buyer",
        "is_active": True,
        "is_email_verified": True,
        "created_at": datetime.now(timezone.utc),
    })

    payload = {
        "name": "New Person",
        "email": email,
        "password": "Password123!",
        "role": "buyer",
    }
    res = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "CONFLICT"


def test_verify_otp_success_creates_and_logs_in_user():
    email = f"verify_{uuid.uuid4().hex[:8]}@example.com"
    send_res = client.post("/api/v1/auth/register/send-otp", json={
        "name": "Aarav Gupta",
        "email": email,
        "password": "MyStrongPassword123!",
        "role": "buyer",
    })
    assert send_res.status_code == 200
    otp = send_res.json()["dev_otp"]

    # Verify OTP
    verify_res = client.post("/api/v1/auth/register/verify-otp", json={
        "email": email,
        "otp": otp,
    })
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"
    assert data["user"]["email"] == email
    assert data["user"]["name"] == "Aarav Gupta"
    assert data["user"]["role"] == "buyer"

    # Verification document should be deleted
    db = get_db()
    assert db.email_verifications.find_one({"email": email}) is None

    # User in db.users should be verified
    user = db.users.find_one({"email": email})
    assert user is not None
    assert user["is_email_verified"] is True

    # User can access /me with returned token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # User can subsequently login normally
    login_res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "MyStrongPassword123!",
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_verify_otp_invalid_code_decrements_attempts():
    email = f"bad_otp_{uuid.uuid4().hex[:8]}@example.com"
    send_res = client.post("/api/v1/auth/register/send-otp", json={
        "name": "Bad OTP User",
        "email": email,
        "password": "Password123!",
        "role": "buyer",
    })
    assert send_res.status_code == 200

    # Submit incorrect OTP
    bad_res = client.post("/api/v1/auth/register/verify-otp", json={
        "email": email,
        "otp": "000000",
    })
    assert bad_res.status_code == 422
    assert "4 attempts remaining" in bad_res.json()["error"]["message"]

    db = get_db()
    record = db.email_verifications.find_one({"email": email})
    assert record["attempts"] == 1


def test_verify_otp_max_attempts_exceeded_invalidates_record():
    email = f"max_attempts_{uuid.uuid4().hex[:8]}@example.com"
    send_res = client.post("/api/v1/auth/register/send-otp", json={
        "name": "Attempts Exhausted",
        "email": email,
        "password": "Password123!",
        "role": "buyer",
    })
    assert send_res.status_code == 200

    # Exhaust 5 attempts
    for i in range(1, 5):
        res = client.post("/api/v1/auth/register/verify-otp", json={"email": email, "otp": "111111"})
        assert res.status_code == 422
        assert f"{5 - i} attempt" in res.json()["error"]["message"]

    # 5th attempt invalidates the record
    final_res = client.post("/api/v1/auth/register/verify-otp", json={"email": email, "otp": "111111"})
    assert final_res.status_code == 422
    assert "Maximum attempts reached" in final_res.json()["error"]["message"]

    db = get_db()
    assert db.email_verifications.find_one({"email": email}) is None

    # 6th attempt has no pending record
    subsequent_res = client.post("/api/v1/auth/register/verify-otp", json={"email": email, "otp": "111111"})
    assert subsequent_res.status_code == 422
    assert "No pending registration found" in subsequent_res.json()["error"]["message"]


def test_verify_otp_expired_code_fails():
    email = f"expired_{uuid.uuid4().hex[:8]}@example.com"
    send_res = client.post("/api/v1/auth/register/send-otp", json={
        "name": "Expired Tester",
        "email": email,
        "password": "Password123!",
        "role": "buyer",
    })
    otp = send_res.json()["dev_otp"]

    # Artificially expire the OTP in database
    db = get_db()
    past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    db.email_verifications.update_one({"email": email}, {"$set": {"expires_at": past_time}})

    res = client.post("/api/v1/auth/register/verify-otp", json={"email": email, "otp": otp})
    assert res.status_code == 422
    assert "expired" in res.json()["error"]["message"].lower()
    assert db.email_verifications.find_one({"email": email}) is None


def test_unverified_user_cannot_login():
    email = f"unverified_{uuid.uuid4().hex[:8]}@example.com"
    db = get_db()
    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "name": "Unverified User",
        "email": email,
        "password_hash": hash_password("ValidPassword123!"),
        "role": "buyer",
        "is_active": True,
        "is_email_verified": False,
        "created_at": datetime.now(timezone.utc),
    })

    res = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "ValidPassword123!",
    })
    assert res.status_code == 403
    assert "Email verification required" in res.json()["error"]["message"]


def test_admin_and_rider_can_login_without_lockout():
    db = get_db()
    now = datetime.now(timezone.utc)

    # Admin with is_email_verified None or False
    admin_email = f"admin_{uuid.uuid4().hex[:8]}@revalue.market"
    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "name": "System Admin",
        "email": admin_email,
        "password_hash": hash_password("AdminPass123!"),
        "role": "admin",
        "is_active": True,
        "is_email_verified": False,
        "created_at": now,
    })

    admin_login = client.post("/api/v1/auth/login", json={
        "email": admin_email,
        "password": "AdminPass123!",
    })
    assert admin_login.status_code == 200
    assert admin_login.json()["user"]["role"] == "admin"

    # Rider with is_email_verified False (riders undergo KYC and admin verification)
    rider_email = f"rider_{uuid.uuid4().hex[:8]}@revalue.market"
    db.users.insert_one({
        "id": str(uuid.uuid4()),
        "name": "Fleet Partner",
        "email": rider_email,
        "password_hash": hash_password("RiderPass123!"),
        "role": "rider",
        "is_active": True,
        "is_email_verified": False,
        "created_at": now,
    })

    rider_login = client.post("/api/v1/auth/login", json={
        "email": rider_email,
        "password": "RiderPass123!",
    })
    assert rider_login.status_code == 200
    assert rider_login.json()["user"]["role"] == "rider"


def test_send_otp_disallows_admin_self_registration():
    email = f"admin_reg_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Admin Attempt",
        "email": email,
        "password": "SecurePassword123!",
        "role": "admin",
    }
    res = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "REQUEST_VALIDATION_ERROR"


def test_production_mode_does_not_leak_dev_otp_and_fails_if_smtp_unconfigured():
    from app.core.config import settings
    orig_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "production"
        email = f"prod_test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "name": "Prod User",
            "email": email,
            "password": "SecurePassword123!",
            "role": "buyer",
        }
        res = client.post("/api/v1/auth/register/send-otp", json=payload)
        # In production with unconfigured SMTP, it must fail with 503 instead of simulating
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "EMAIL_DELIVERY_FAILED"
        assert "dev_otp" not in res.json().get("data", {})
    finally:
        settings.ENVIRONMENT = orig_env


def test_hourly_rate_limit_enforced():
    email = f"ratelimit_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Rate Limit User",
        "email": email,
        "password": "Password123!",
        "role": "buyer",
    }
    res = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res.status_code == 200

    db = get_db()
    # Bypass 60-second cooldown by setting resend_available_at to past, and set request_count to 5
    db.email_verifications.update_one(
        {"email": email},
        {"$set": {
            "resend_available_at": datetime.now(timezone.utc) - timedelta(seconds=10),
            "request_count": 5
        }}
    )

    res_blocked = client.post("/api/v1/auth/register/send-otp", json=payload)
    assert res_blocked.status_code == 422
    assert "Maximum OTP request limit reached" in res_blocked.json()["error"]["message"]
