import hmac
import hashlib
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from main import app
from app.db.connection import DatabaseManager, get_db
from app.core.config import settings
from app.core.errors import ConflictError, ValidationError, NotFoundError
from app.services.email_service import AppsScriptEmailProvider, EmailService
from app.services.delivery_otp_service import DeliveryOtpService, hash_delivery_otp
from app.services.order_service import OrderService
from app.schemas.orders import OrderStatus, PayoutStatus

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    DatabaseManager.connect(force_memory=True)


def create_user(role="buyer", email_verified=True):
    email = f"user_{uuid.uuid4().hex[:8]}@revalue.market"
    client.post("/api/v1/auth/register", json={
        "name": f"Test {role.title()}",
        "email": email,
        "password": "Password123!",
        "role": role
    })
    db = get_db()
    if email_verified:
        db.users.update_one({"email": email}, {"$set": {"is_email_verified": True}})
        res = client.post("/api/v1/auth/login", json={
            "email": email,
            "password": "Password123!"
        })
        return res.json()["access_token"], res.json()["user"]["id"], email
    else:
        db.users.update_one({"email": email}, {"$set": {"is_email_verified": False}})
        user = db.users.find_one({"email": email})
        return None, user["id"], email


def create_sample_order(seller_id=None, buyer_id=None, buyer_verified=True):
    db = get_db()
    if not seller_id:
        _, seller_id, _ = create_user("seller")
    if not buyer_id:
        _, buyer_id, buyer_email = create_user("buyer", email_verified=buyer_verified)
    else:
        buyer = db.users.find_one({"id": buyer_id})
        buyer_email = buyer["email"] if buyer else "buyer@example.com"

    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    order_doc = {
        "_id": order_id,
        "order_id": order_id,
        "product_id": f"prod_{uuid.uuid4().hex[:6]}",
        "product_title": "Apple iPhone 13 128GB Starlight",
        "seller_id": seller_id,
        "buyer_id": buyer_id,
        "status": OrderStatus.PICKED_UP.value,
        "payout_status": PayoutStatus.HELD.value,
        "payment_method": "prepaid",
        "shipping_address": {
            "full_name": "Test Recipient",
            "phone": "9876543210",
            "street": "123 Market Rd",
            "city": "Mumbai",
            "state": "Maharashtra",
            "postal_code": "400001",
            "country": "India"
        },
        "shipment_info": {
            "courier_name": "ReValue Swift",
            "awb_code": f"AWB-{uuid.uuid4().hex[:6].upper()}",
            "is_courier_verified": True
        },
        "delivery_otp": None,
        "delivery_otp_masked": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "status_history": []
    }
    db.orders.insert_one(order_doc)
    return order_id, buyer_id, buyer_email


# ---------------------------------------------------------------------------
# Test 1: Verified Buyer Email Requirement
# ---------------------------------------------------------------------------
def test_verified_buyer_email_requirement():
    """Unverified buyer accounts must be rejected from receiving a delivery verification OTP."""
    _, unverified_buyer_id, _ = create_user("buyer", email_verified=False)
    order_id, _, _ = create_sample_order(buyer_id=unverified_buyer_id)

    with pytest.raises(ValidationError) as exc_info:
        DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")
    assert "verified registered email" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test 2: Successful Gmail Delivery OTP Dispatch
# ---------------------------------------------------------------------------
def test_successful_gmail_delivery_otp_dispatch():
    """Verify that when Apps Script is configured, action 'send_delivery_otp' is invoked with order details."""
    order_id, buyer_id, buyer_email = create_sample_order(buyer_verified=True)

    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret_hex_64_characters_for_delivery_gateway"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "message": "Delivery verification email dispatched successfully.",
            "order_id": order_id,
            "timestamp": "2026-11-20T10:00:00.000Z"
        }

        with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
            res = DeliveryOtpService.generate_and_dispatch_delivery_otp(
                order_id=order_id,
                actor_id="seller_123",
                carrier_name="ReValue Local Express"
            )
            assert res["success"] is True
            assert res["order_id"] == order_id
            assert res["delivery_otp_masked"].startswith("**")
            assert len(res["delivery_otp_masked"]) == 4

            # Verify exact payload dispatched to Google Apps Script
            mock_post.assert_called_once()
            called_payload = mock_post.call_args[1]["json"]
            assert called_payload["action"] == "send_delivery_otp"
            assert called_payload["email"] == buyer_email.lower().strip()
            assert called_payload["order_id"] == order_id
            assert called_payload["product_title"] == "Apple iPhone 13 128GB Starlight"
            assert called_payload["carrier_name"] == "ReValue Local Express"
            assert called_payload["shared_secret"] == "secret_hex_64_characters_for_delivery_gateway"
            assert len(called_payload["otp"]) == 6

            # Verify MongoDB storage contains HMAC hash and NEVER plaintext
            db = get_db()
            saved_order = db.orders.find_one({"order_id": order_id})
            otp_subdoc = saved_order["delivery_otp"]
            assert "otp_hash" in otp_subdoc
            assert "otp" not in otp_subdoc
            assert otp_subdoc["masked"] == res["delivery_otp_masked"]
            assert otp_subdoc["verified"] is False
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


# ---------------------------------------------------------------------------
# Test 3: Invalid Buyer Email Rejection
# ---------------------------------------------------------------------------
def test_invalid_buyer_email_rejection():
    """Non-existent buyer or empty buyer email triggers validation or not found error."""
    db = get_db()
    order_id, _, _ = create_sample_order()
    db.orders.update_one({"order_id": order_id}, {"$set": {"buyer_id": "non_existent_user_999"}})

    with pytest.raises(NotFoundError):
        DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")


# ---------------------------------------------------------------------------
# Test 4: Google Apps Script Gateway Failure
# ---------------------------------------------------------------------------
def test_apps_script_gateway_failure():
    """When Google Apps Script returns an error, AppsScriptEmailProvider reports failure accurately."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret_hex_64_characters_for_delivery_gateway"

        mock_resp = MagicMock()
        mock_resp.status_code = 500

        with patch("httpx.Client.post", return_value=mock_resp):
            success, err = AppsScriptEmailProvider.send_delivery_otp(
                email="buyer@example.com",
                name="Buyer Name",
                otp="123456",
                order_id="ORD-TEST",
            )
            assert success is False
            assert "HTTP status 500" in err
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


# ---------------------------------------------------------------------------
# Test 5: Invalid OTP Rejection and Decrementing Attempts
# ---------------------------------------------------------------------------
def test_invalid_otp_rejection_and_decrementing_attempts():
    """Entering an incorrect OTP raises ValidationError with remaining attempts."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    res = DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")

    with pytest.raises(ValidationError) as exc_info:
        DeliveryOtpService.verify_delivery_otp(order_id, entered_otp="000000", actor_id="rider_1")
    assert "4 attempts remaining" in str(exc_info.value)

    db = get_db()
    order = db.orders.find_one({"order_id": order_id})
    assert order["delivery_otp"]["attempts"] == 1


# ---------------------------------------------------------------------------
# Test 6: Expired OTP Rejection (10-minute expiry)
# ---------------------------------------------------------------------------
def test_expired_otp_rejection():
    """An OTP past its 10-minute expiry window is rejected."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    res = DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")
    raw_otp = res.get("dev_otp", "123456")

    # Fast-forward expiry into the past
    db = get_db()
    past_time = datetime.now(timezone.utc) - timedelta(minutes=15)
    db.orders.update_one({"order_id": order_id}, {"$set": {"delivery_otp.expires_at": past_time}})

    with pytest.raises(ValidationError) as exc_info:
        DeliveryOtpService.verify_delivery_otp(order_id, entered_otp=raw_otp, actor_id="rider_1")
    assert "expired" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# Test 7: Five Incorrect Attempts and Lockout
# ---------------------------------------------------------------------------
def test_five_incorrect_attempts_and_lockout():
    """5 consecutive failed attempts lock the order's delivery verification."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")

    for i in range(4):
        with pytest.raises(ValidationError):
            DeliveryOtpService.verify_delivery_otp(order_id, entered_otp=f"11111{i}", actor_id="rider_1")

    # 5th attempt locks
    with pytest.raises(ValidationError) as exc_info:
        DeliveryOtpService.verify_delivery_otp(order_id, entered_otp="999999", actor_id="rider_1")
    assert "locked" in str(exc_info.value).lower()

    db = get_db()
    order = db.orders.find_one({"order_id": order_id})
    assert order["delivery_otp"]["attempts"] == 5
    assert order["delivery_otp"]["is_locked"] is True

    # 6th attempt is blocked immediately by lockout guard
    with pytest.raises(ValidationError) as lock_exc:
        DeliveryOtpService.verify_delivery_otp(order_id, entered_otp="123456", actor_id="rider_1")
    assert "locked" in str(lock_exc.value).lower()


# ---------------------------------------------------------------------------
# Test 8: Resend Cooldown (60 seconds)
# ---------------------------------------------------------------------------
def test_resend_cooldown():
    """Calling resend within 60 seconds raises ValidationError."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")

    with pytest.raises(ValidationError) as exc_info:
        DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin", is_resend=True)
    assert "seconds before requesting a new delivery code" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test 9: Successful One-Time Verification & Inspection Activation
# ---------------------------------------------------------------------------
def test_successful_one_time_verification():
    """Submitting the valid OTP advances order to DELIVERED and activates 48-Hour Inspection Window."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    res = DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")
    raw_otp = res.get("dev_otp")

    assert raw_otp is not None
    is_valid = DeliveryOtpService.verify_delivery_otp(order_id, entered_otp=raw_otp, actor_id="rider_99")
    assert is_valid is True

    updated_order = DeliveryOtpService.complete_delivery_atomically(order_id, actor_id="rider_99")
    assert updated_order["status"] == OrderStatus.DELIVERED.value
    assert updated_order["delivery_otp"]["verified"] is True
    assert updated_order["payout_status"] == PayoutStatus.HELD_INSPECTION.value
    assert updated_order["inspection_deadline"] is not None


# ---------------------------------------------------------------------------
# Test 10: Wrong Order Association (Domain & Order Binding)
# ---------------------------------------------------------------------------
def test_wrong_order_association():
    """An OTP generated for Order 1 cannot be used to verify Order 2."""
    order_id_1, _, _ = create_sample_order(buyer_verified=True)
    order_id_2, _, _ = create_sample_order(buyer_verified=True)

    res_1 = DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id_1, actor_id="admin")
    otp_1 = res_1.get("dev_otp")

    DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id_2, actor_id="admin")

    # Try to verify Order 2 using Order 1's OTP
    with pytest.raises(ValidationError):
        DeliveryOtpService.verify_delivery_otp(order_id_2, entered_otp=otp_1, actor_id="rider_1")


# ---------------------------------------------------------------------------
# Test 11: Public Tracking API OTP Redaction
# ---------------------------------------------------------------------------
def test_public_tracking_api_otp_redaction():
    """When Apps Script is configured, tracking endpoint suppresses plaintext OTP and displays masked only."""
    buyer_token, buyer_id, _ = create_user("buyer", email_verified=True)
    order_id, _, _ = create_sample_order(buyer_id=buyer_id)
    DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")

    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret_hex_64_characters"

        track_res = client.get(f"/api/v1/orders/{order_id}/tracking", headers={"Authorization": f"Bearer {buyer_token}"})
        assert track_res.status_code == 200
        data = track_res.json()
        assert data["buyer_delivery_otp"] is None
        assert data["delivery_otp_masked"].startswith("**")
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret


# ---------------------------------------------------------------------------
# Test 12: Rider Dashboard OTP Redaction
# ---------------------------------------------------------------------------
def test_rider_dashboard_otp_redaction():
    """Rider job endpoints must never leak delivery_otp or delivery_otp_hash to the rider."""
    db = get_db()
    order_id, _, _ = create_sample_order(buyer_verified=True)
    DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")

    # Create dummy rider profile and delivery job
    rider_profile_id = f"rider_{uuid.uuid4().hex[:6]}"
    rider_user_id = f"user_rider_{uuid.uuid4().hex[:6]}"
    db.rider_profiles.insert_one({
        "id": rider_profile_id,
        "user_id": rider_user_id,
        "name": "Redaction Test Rider",
        "application_status": "approved"
    })

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    db.delivery_jobs.insert_one({
        "id": job_id,
        "order_id": order_id,
        "assigned_rider_id": rider_profile_id,
        "status": "out_for_delivery",
        "delivery_otp": {"otp_hash": "sensitive_hash", "masked": "**12"},
        "delivery_otp_hash": "sensitive_hash_legacy"
    })

    from app.services.rider_service import RiderService
    job_detail = RiderService.get_job_detail(rider_user_id, job_id)
    assert "delivery_otp" not in job_detail
    assert "delivery_otp_hash" not in job_detail


# ---------------------------------------------------------------------------
# Test 13: Local Delivery Workflow Integration
# ---------------------------------------------------------------------------
def test_local_delivery_workflow_integration():
    """Tests end-to-end local rider pickup, OTP dispatch, and doorstep verification."""
    seller_token, seller_id, _ = create_user("seller")
    buyer_token, buyer_id, _ = create_user("buyer", email_verified=True)
    order_id, _, _ = create_sample_order(seller_id=seller_id, buyer_id=buyer_id)

    db = get_db()
    rider_profile_id = f"rider_{uuid.uuid4().hex[:6]}"
    rider_user_id = f"user_rider_{uuid.uuid4().hex[:6]}"
    db.rider_profiles.insert_one({
        "id": rider_profile_id,
        "user_id": rider_user_id,
        "name": "Ramesh Partner",
        "application_status": "approved",
        "total_deliveries_completed": 0
    })

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    db.delivery_jobs.insert_one({
        "id": job_id,
        "order_id": order_id,
        "assigned_rider_id": rider_profile_id,
        "status": "accepted"
    })

    from app.services.rider_service import RiderService

    # 1. Rider arrives at pickup
    RiderService.mark_arrived_pickup(rider_user_id, job_id)

    # 2. Rider confirms pickup -> automatically generates & dispatches delivery OTP
    RiderService.confirm_pickup(rider_user_id, job_id, notes="Package inspected")

    order = db.orders.find_one({"order_id": order_id})
    assert order["status"] == "picked_up"
    assert order["delivery_otp"]["masked"] is not None

    raw_otp = order["delivery_otp"].get("_dev_plain_otp")

    # 3. Rider starts delivery
    RiderService.start_delivery(rider_user_id, job_id)

    # 4. Rider verifies OTP at buyer doorstep
    updated_job = RiderService.verify_delivery_otp_and_complete(
        user_id=rider_user_id,
        job_id=job_id,
        entered_otp=raw_otp,
        notes="Delivered to buyer doorstep."
    )
    assert updated_job["status"] == "delivered"

    final_order = db.orders.find_one({"order_id": order_id})
    assert final_order["status"] == "delivered"
    assert final_order["delivery_otp"]["verified"] is True


# ---------------------------------------------------------------------------
# Test 14: Courier Delivery Handover and Verification Compatibility
# ---------------------------------------------------------------------------
def test_courier_delivery_handover_compatibility():
    """Tests that courier confirm_handover dispatches the delivery OTP and verify completes it."""
    seller_token, seller_id, _ = create_user("seller")
    buyer_token, buyer_id, _ = create_user("buyer", email_verified=True)
    order_id, _, _ = create_sample_order(seller_id=seller_id, buyer_id=buyer_id)

    # Set status to shipment_booked for handover
    db = get_db()
    db.orders.update_one({"order_id": order_id}, {"$set": {"status": "shipment_booked"}})

    from app.services.delivery_service import DeliveryService
    handover_res = DeliveryService.confirm_handover(seller_id, order_id, notes="Handed to BlueDart")
    assert handover_res["status"] == "picked_up"
    assert handover_res["delivery_otp_masked"] is not None

    order = db.orders.find_one({"order_id": order_id})
    raw_otp = order["delivery_otp"].get("_dev_plain_otp")
    assert raw_otp is not None

    complete_res = DeliveryService.verify_delivery_otp_and_complete(seller_id, order_id, raw_otp)
    assert complete_res["status"] == "delivered"


# ---------------------------------------------------------------------------
# Test 15: Concurrent Verification & Replay Prevention
# ---------------------------------------------------------------------------
def test_concurrent_verification_and_replay_prevention():
    """An already verified order rejects duplicate verification attempts with ConflictError."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    res = DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")
    raw_otp = res.get("dev_otp")

    # First verification succeeds
    DeliveryOtpService.verify_delivery_otp(order_id, raw_otp, actor_id="rider_1")
    DeliveryOtpService.complete_delivery_atomically(order_id, actor_id="rider_1")

    # Second concurrent or replay attempt is rejected
    with pytest.raises(ConflictError) as exc_info:
        DeliveryOtpService.verify_delivery_otp(order_id, raw_otp, actor_id="rider_2")
    assert "already delivered and verified" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# Test 16: Duplicate Delivery Completion Prevention (Atomic CAS)
# ---------------------------------------------------------------------------
def test_duplicate_delivery_completion_prevention():
    """Atomic compare-and-swap prevents completing delivery more than once."""
    order_id, _, _ = create_sample_order(buyer_verified=True)
    DeliveryOtpService.generate_and_dispatch_delivery_otp(order_id, actor_id="admin")

    # Complete once
    DeliveryOtpService.complete_delivery_atomically(order_id, actor_id="rider_1")

    # Complete second time raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        DeliveryOtpService.complete_delivery_atomically(order_id, actor_id="rider_2")
    assert "already delivered" in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# Test 17: Legacy Order Compatibility (Plaintext Fallback)
# ---------------------------------------------------------------------------
def test_legacy_order_compatibility():
    """Orders stored with legacy plaintext delivery_otp.otp are verified via constant-time fallback."""
    db = get_db()
    order_id, _, _ = create_sample_order(buyer_verified=True)

    # Inject legacy structure
    db.orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "delivery_otp": {
                    "otp": "654321",
                    "masked": "**21",
                    "verified": False,
                    "attempts": 0,
                    "max_attempts": 5,
                    "expires_at": datetime.now(timezone.utc) + timedelta(hours=24)
                }
            }
        }
    )

    # 1. Invalid OTP rejected
    with pytest.raises(ValidationError):
        DeliveryOtpService.verify_delivery_otp(order_id, entered_otp="000000", actor_id="rider_1")

    # 2. Correct legacy OTP accepted
    is_valid = DeliveryOtpService.verify_delivery_otp(order_id, entered_otp="654321", actor_id="rider_1")
    assert is_valid is True


# ---------------------------------------------------------------------------
# Test 18: Existing Registration OTP Regression Check
# ---------------------------------------------------------------------------
def test_existing_registration_otp_regression():
    """Ensures registration OTP continues to use action: 'send_otp' without disruption."""
    orig_enabled = settings.APPS_SCRIPT_EMAIL_ENABLED
    orig_url = settings.APPS_SCRIPT_EMAIL_URL
    orig_secret = settings.APPS_SCRIPT_SHARED_SECRET

    try:
        settings.APPS_SCRIPT_EMAIL_ENABLED = True
        settings.APPS_SCRIPT_EMAIL_URL = "https://script.google.com/macros/s/AKfycb_test/exec"
        settings.APPS_SCRIPT_SHARED_SECRET = "secret_hex_64_characters"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "success": True,
            "message": "Verification email dispatched successfully.",
            "timestamp": "2026-11-20T10:00:00.000Z"
        }

        with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
            success, err = EmailService.send_registration_otp("new_buyer@example.com", "New Buyer", "654321")
            assert success is True
            assert err is None
            called_payload = mock_post.call_args[1]["json"]
            assert called_payload["action"] == "send_otp"
            assert called_payload["otp"] == "654321"
            assert called_payload["expires_in_minutes"] == 5
    finally:
        settings.APPS_SCRIPT_EMAIL_ENABLED = orig_enabled
        settings.APPS_SCRIPT_EMAIL_URL = orig_url
        settings.APPS_SCRIPT_SHARED_SECRET = orig_secret
