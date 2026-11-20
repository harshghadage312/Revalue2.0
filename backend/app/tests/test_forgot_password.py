import hashlib
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from main import app
from app.db.connection import get_db
from app.core.config import settings

client = TestClient(app)


def test_forgot_password_generic_response_for_existing_and_non_existing():
    """Confirms identical generic responses are returned to prevent email enumeration."""
    db = get_db()
    existing_email = f"user_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Existing User",
        "email": existing_email,
        "password": "ValidPassword123!",
        "role": "buyer"
    })

    non_existing_email = f"no_such_user_{uuid.uuid4().hex[:8]}@revalue.market"

    # 1. Existing user
    res_existing = client.post("/api/v1/auth/forgot-password", json={"email": existing_email})
    assert res_existing.status_code == 200
    data_existing = res_existing.json()
    assert data_existing["message"] == "If an account exists with this email, you will receive a password reset link."
    assert data_existing["cooldown_seconds"] == 60

    # 2. Non-existing user
    res_non_existing = client.post("/api/v1/auth/forgot-password", json={"email": non_existing_email})
    assert res_non_existing.status_code == 200
    data_non_existing = res_non_existing.json()
    assert data_non_existing["message"] == "If an account exists with this email, you will receive a password reset link."
    assert data_non_existing["cooldown_seconds"] == 60


def test_forgot_password_stores_sha256_hash_and_no_plaintext_token():
    """Verifies that only the SHA-256 hash of the token is stored in MongoDB, never the raw token."""
    db = get_db()
    email = f"secure_user_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Hash Check",
        "email": email,
        "password": "SecurePassword123!",
        "role": "buyer"
    })

    res = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res.status_code == 200
    dev_token = res.json().get("dev_reset_token")
    assert dev_token is not None

    expected_hash = hashlib.sha256(dev_token.encode("utf-8")).hexdigest()

    record = db.password_resets.find_one({"email": email, "token_hash": expected_hash})
    assert record is not None
    assert record.get("used") is False
    exp = record.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    assert exp > datetime.now(timezone.utc)
    # Confirm no plaintext token field was stored
    assert "token" not in record or record["token"] != dev_token


def test_password_reset_success_lifecycle():
    """Tests complete reset lifecycle: request, reset, old password fails, new password works."""
    email = f"reset_life_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Reset Lifecycle",
        "email": email,
        "password": "OldPassword123!",
        "role": "buyer"
    })

    # Request reset
    req_res = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert req_res.status_code == 200
    raw_token = req_res.json()["dev_reset_token"]

    # Reset password with strong new password
    reset_res = client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "SuperNewPassword123!"
    })
    assert reset_res.status_code == 200
    assert "successfully reset" in reset_res.json()["message"].lower()

    # Old password fails
    old_login = client.post("/api/v1/auth/login", json={"email": email, "password": "OldPassword123!"})
    assert old_login.status_code == 401

    # New password works
    new_login = client.post("/api/v1/auth/login", json={"email": email, "password": "SuperNewPassword123!"})
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_token_cannot_be_reused():
    """Confirms token is single-use and atomic compare-and-swap prevents replay."""
    email = f"single_use_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Single Use",
        "email": email,
        "password": "InitialPassword123!",
        "role": "buyer"
    })

    req_res = client.post("/api/v1/auth/forgot-password", json={"email": email})
    raw_token = req_res.json()["dev_reset_token"]

    # First reset succeeds
    res1 = client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "FirstNewPassword123!"
    })
    assert res1.status_code == 200

    # Second reset with SAME token fails (already used)
    res2 = client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "SecondNewPassword123!"
    })
    assert res2.status_code in [400, 422]
    assert "already been used" in res2.json()["error"]["message"].lower()


def test_invalid_and_expired_token_rejections():
    """Tests rejections of invalid tokens and expired tokens."""
    db = get_db()
    email = f"expire_test_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Expiry Test",
        "email": email,
        "password": "TestPassword123!",
        "role": "buyer"
    })

    # 1. Invalid token
    inv_res = client.post("/api/v1/auth/reset-password", json={
        "token": "completely_bogus_token_12345",
        "new_password": "ValidNewPassword123!"
    })
    assert inv_res.status_code in [400, 422]
    assert "invalid or has expired" in inv_res.json()["error"]["message"].lower()

    # 2. Expired token
    req_res = client.post("/api/v1/auth/forgot-password", json={"email": email})
    raw_token = req_res.json()["dev_reset_token"]
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    # Manually backdate expiry to the past
    past_time = datetime.now(timezone.utc) - timedelta(minutes=20)
    db.password_resets.update_one(
        {"token_hash": token_hash},
        {"$set": {"expires_at": past_time}}
    )

    exp_res = client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "ValidNewPassword123!"
    })
    assert exp_res.status_code in [400, 422]
    assert "expired" in exp_res.json()["error"]["message"].lower()


def test_password_strength_validation():
    """Confirms passwords under 8 characters are rejected."""
    email = f"weak_pw_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Weak Pw",
        "email": email,
        "password": "ValidPassword123!",
        "role": "buyer"
    })

    req_res = client.post("/api/v1/auth/forgot-password", json={"email": email})
    raw_token = req_res.json()["dev_reset_token"]

    # Short password (< 8 chars)
    short_res = client.post("/api/v1/auth/reset-password", json={
        "token": raw_token,
        "new_password": "short"
    })
    assert short_res.status_code == 422


def test_resend_cooldown_and_rate_limiting():
    """Enforces 60-second resend cooldown and hourly ceiling."""
    db = get_db()
    email = f"cooldown_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Cooldown Test",
        "email": email,
        "password": "ValidPassword123!",
        "role": "buyer"
    })

    # First request succeeds
    res1 = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res1.status_code == 200

    # Immediate second request fails with cooldown error
    res2 = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res2.status_code in [400, 422]
    assert "seconds before requesting" in res2.json()["error"]["message"]

    # Seed 5 requests in past 30 minutes to trigger hourly limit
    now = datetime.now(timezone.utc)
    db.password_resets.delete_many({"email": email})
    for i in range(5):
        db.password_resets.insert_one({
            "_id": str(uuid.uuid4()),
            "token_hash": f"hash_{i}",
            "user_id": "test_user_id",
            "email": email,
            "expires_at": now + timedelta(minutes=15),
            "used": True,
            "created_at": now - timedelta(minutes=30 - (i * 3)),
        })

    rate_res = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert rate_res.status_code in [400, 422]
    assert "limit reached" in rate_res.json()["error"]["message"].lower()


def test_previous_tokens_invalidated_on_new_request():
    """Confirms that requesting a new reset token invalidates any previously unconsumed token."""
    db = get_db()
    email = f"inval_test_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": "Invalidate Test",
        "email": email,
        "password": "ValidPassword123!",
        "role": "buyer"
    })

    res1 = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res1.status_code == 200
    token1 = res1.json()["dev_reset_token"]

    # Fast forward cooldown so we can request again
    db.password_resets.update_many(
        {"email": email},
        {"$set": {"created_at": datetime.now(timezone.utc) - timedelta(seconds=70)}}
    )

    res2 = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res2.status_code == 200
    token2 = res2.json()["dev_reset_token"]
    assert token1 != token2

    # Old token1 is now invalidated / used
    old_res = client.post("/api/v1/auth/reset-password", json={
        "token": token1,
        "new_password": "NewPassword123!"
    })
    assert old_res.status_code in [400, 422]
    assert "already been used" in old_res.json()["error"]["message"].lower()

    # New token2 succeeds
    new_res = client.post("/api/v1/auth/reset-password", json={
        "token": token2,
        "new_password": "NewPassword123!"
    })
    assert new_res.status_code == 200
