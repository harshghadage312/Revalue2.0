import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple

from app.core.config import settings
from app.core.errors import (
    AppException,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.logging import logger
from app.db.connection import get_db
from app.schemas.orders import OrderStatus, PayoutStatus
from app.services.email_service import EmailService, mask_email


def get_delivery_otp_domain_key() -> bytes:
    """
    Derives a cryptographically domain-separated HMAC key for doorstep delivery OTPs.
    Prevents key reuse or collision with authentication JWTs or registration OTPs.
    """
    secret_bytes = settings.JWT_SECRET_KEY.encode("utf-8")
    return hmac.new(secret_bytes, b"revalue:delivery-verification-otp:v1", hashlib.sha256).digest()


def hash_delivery_otp(order_id: str, otp: str) -> str:
    """
    Computes an HMAC-SHA256 hash strictly bound to the specific order_id and OTP digits.
    An OTP generated for Order A will never produce a matching hash for Order B.
    """
    derived_key = get_delivery_otp_domain_key()
    message = f"order:{order_id.strip()}:otp:{otp.strip()}".encode("utf-8")
    return hmac.new(derived_key, message, hashlib.sha256).hexdigest()


class DeliveryOtpService:
    """
    Centralized service for generating, hashing, dispatching, and verifying
    Buyer Doorstep Delivery Verification OTPs.
    """

    @staticmethod
    def generate_and_dispatch_delivery_otp(
        order_id: str,
        actor_id: str,
        is_resend: bool = False,
        carrier_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a 6-digit numeric delivery OTP, hashes it via HMAC-SHA256,
        dispatches it exclusively to the buyer's verified registered email,
        and records the 10-minute expiry window in MongoDB.
        """
        db = get_db()
        order = db.orders.find_one({"order_id": order_id})
        if not order:
            raise NotFoundError(f"Order '{order_id}' not found.")

        # 1. Allowed lifecycle states for delivery OTP generation
        valid_statuses = [
            OrderStatus.SHIPMENT_BOOKED.value,
            OrderStatus.PICKUP_SCHEDULED.value,
            OrderStatus.PICKED_UP.value,
            OrderStatus.IN_TRANSIT.value,
            OrderStatus.OUT_FOR_DELIVERY.value,
            "shipment_booked",
            "pickup_scheduled",
            "picked_up",
            "in_transit",
            "out_for_delivery",
        ]
        if order.get("status") not in valid_statuses:
            raise ConflictError(
                f"Cannot generate or resend delivery OTP for order in '{order.get('status')}' state."
            )

        # 2. Prevent regeneration if order is already delivered or verified
        existing_otp_info = order.get("delivery_otp") or {}
        if existing_otp_info.get("verified") or order.get("status") == OrderStatus.DELIVERED.value:
            raise ConflictError("Order delivery has already been verified and completed.")

        now = datetime.now(timezone.utc)

        # 3. Buyer Email Verification Guard
        buyer_id = order.get("buyer_id")
        buyer = db.users.find_one({"id": buyer_id})
        if not buyer:
            raise NotFoundError(f"Buyer account '{buyer_id}' associated with order not found.")

        buyer_email = (buyer.get("email") or "").strip().lower()
        if not buyer_email or not buyer.get("is_email_verified", False):
            logger.error(f"[DeliveryOtp] Rejected OTP generation: Buyer '{buyer_id}' has unverified email.")
            raise ValidationError(
                "Buyer does not have a verified registered email address. "
                "Doorstep delivery OTP can only be dispatched to verified user accounts."
            )

        # 4. Rate Limiting & Resend Cooldown
        if is_resend:
            resend_time = existing_otp_info.get("resend_available_at")
            if resend_time:
                if resend_time.tzinfo is None:
                    resend_time = resend_time.replace(tzinfo=timezone.utc)
                if now < resend_time:
                    remaining_sec = max(1, int((resend_time - now).total_seconds()))
                    raise ValidationError(
                        f"Please wait {remaining_sec} seconds before requesting a new delivery code."
                    )

            # Enforce hourly request rate limit (max 5 requests per hour)
            first_gen_at = existing_otp_info.get("generated_at")
            if first_gen_at and first_gen_at.tzinfo is None:
                first_gen_at = first_gen_at.replace(tzinfo=timezone.utc)
            if first_gen_at and (now - first_gen_at) < timedelta(hours=1):
                request_count = existing_otp_info.get("request_count", 1)
                if request_count >= settings.DELIVERY_OTP_MAX_HOURLY_REQUESTS:
                    raise ValidationError(
                        "Maximum delivery OTP request limit reached. Please wait an hour before requesting again."
                    )
                new_request_count = request_count + 1
            else:
                new_request_count = 1
        else:
            new_request_count = existing_otp_info.get("request_count", 0) + 1

        # 5. Cryptographically secure 6-digit numeric OTP (100000 - 999999)
        otp_plain = f"{secrets.randbelow(900000) + 100000:06d}"
        otp_hash = hash_delivery_otp(order_id, otp_plain)
        otp_masked = f"**{otp_plain[-2:]}"

        expires_at = now + timedelta(minutes=settings.DELIVERY_OTP_EXPIRE_MINUTES)
        resend_available_at = now + timedelta(seconds=settings.DELIVERY_OTP_RESEND_COOLDOWN_SECONDS)

        # 6. Dispatch delivery OTP email via Google Apps Script gateway
        resolved_carrier = carrier_name or order.get("shipment_info", {}).get("courier_name") or "ReValue Delivery Partner"
        email_sent, error_reason = EmailService.send_delivery_otp(
            email=buyer_email,
            name=buyer.get("name") or "ReValue Customer",
            otp=otp_plain,
            order_id=order_id,
            product_title=order.get("product_title", "Smartphone"),
            carrier_name=resolved_carrier,
        )

        if not email_sent:
            if settings.is_production:
                logger.error(f"[DeliveryOtp] Production delivery OTP email failed for order {order_id} ({mask_email(buyer_email)}): {error_reason}")
                raise AppException(
                    message=f"Failed to dispatch delivery verification email: {error_reason or 'Gateway error'}",
                    code="EMAIL_DELIVERY_FAILED",
                    status_code=503,
                )
            logger.warning(f"[DeliveryOtp] Delivery OTP email simulation for order {order_id}: {error_reason}")

        # 7. Persist OTP state to MongoDB with ZERO plaintext secrets
        otp_doc = {
            "otp_hash": otp_hash,
            "masked": otp_masked,
            "generated_at": now,
            "expires_at": expires_at,
            "resend_available_at": resend_available_at,
            "attempts": 0,
            "max_attempts": settings.DELIVERY_OTP_MAX_ATTEMPTS,
            "request_count": new_request_count,
            "is_locked": False,
            "verified": False,
            "verified_at": None,
            "verified_by": None,
            "recipient_email_masked": mask_email(buyer_email),
            "dispatch_channel": "gmail_apps_script",
        }

        # For test simulation strictly in local non-production environments when email is not configured
        if not settings.is_production and not settings.is_apps_script_configured:
            otp_doc["_dev_plain_otp"] = otp_plain

        db.orders.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "delivery_otp": otp_doc,
                    "delivery_otp_masked": otp_masked,
                    "updated_at": now,
                }
            }
        )

        logger.info(f"[DeliveryOtp] Generated delivery OTP for order {order_id} (masked: {otp_masked}, recipient: {mask_email(buyer_email)})")

        resp = {
            "success": True,
            "order_id": order_id,
            "delivery_otp_masked": otp_masked,
            "recipient_email_masked": mask_email(buyer_email),
            "cooldown_seconds": settings.DELIVERY_OTP_RESEND_COOLDOWN_SECONDS,
            "expires_in_minutes": settings.DELIVERY_OTP_EXPIRE_MINUTES,
        }

        if not settings.is_production and not settings.is_apps_script_configured:
            resp["dev_otp"] = otp_plain

        return resp

    @staticmethod
    def verify_delivery_otp(order_id: str, entered_otp: str, actor_id: str) -> bool:
        """
        Validates the submitted OTP against the stored HMAC-SHA256 hash.
        Enforces 10-minute expiry, lockout at 5 failed attempts, and single-use validation.
        Supports legacy orders with constant-time fallback comparison.
        """
        db = get_db()
        order = db.orders.find_one({"order_id": order_id})
        if not order:
            raise NotFoundError(f"Order '{order_id}' not found.")

        otp_info = order.get("delivery_otp") or {}

        # 1. Check if already delivered or verified
        if order.get("status") == OrderStatus.DELIVERED.value or otp_info.get("verified"):
            raise ConflictError("Order is already delivered and verified.")

        now = datetime.now(timezone.utc)

        # 2. Check lockout
        if otp_info.get("is_locked"):
            raise ValidationError(
                "Maximum verification attempts exceeded. Delivery verification is locked. "
                "Please request a new delivery OTP or contact support."
            )

        # 3. Check Expiration
        expires_at = otp_info.get("expires_at")
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if now > expires_at:
                raise ValidationError("Delivery verification code has expired. Please request a new delivery OTP.")

        # 4. Check Attempt Limit
        attempts = otp_info.get("attempts", 0)
        max_attempts = otp_info.get("max_attempts", settings.DELIVERY_OTP_MAX_ATTEMPTS)
        if attempts >= max_attempts:
            db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"delivery_otp.is_locked": True, "updated_at": now}}
            )
            raise ValidationError("Maximum verification attempts exceeded. Delivery verification is locked.")

        # 5. Evaluate OTP Code
        clean_code = str(entered_otp or "").strip()
        is_match = False

        # Mode A: Hashed storage (New standard)
        if otp_info.get("otp_hash"):
            expected_hash = otp_info["otp_hash"]
            calc_hash = hash_delivery_otp(order_id, clean_code)
            is_match = hmac.compare_digest(expected_hash, calc_hash)

        # Mode B: Legacy plaintext storage (Safe constant-time backward compatibility)
        elif "otp" in otp_info:
            legacy_plain = str(otp_info["otp"]).strip()
            is_match = hmac.compare_digest(legacy_plain, clean_code)

        # Mode C: Fallback to courier provider memory if order has no delivery_otp sub-doc
        else:
            from app.integrations.courier.manager import get_courier_provider
            courier = get_courier_provider()
            is_match = courier.verify_delivery_otp(order_id, clean_code)

        # Mode D: In dev/test environments only, verify against courier provider sandbox OTP if not matched yet
        if not is_match and not settings.is_production:
            try:
                from app.integrations.courier.manager import get_courier_provider
                courier = get_courier_provider()
                if hasattr(courier, "verify_delivery_otp") and courier.verify_delivery_otp(order_id, clean_code):
                    is_match = True
            except Exception:
                pass

        # 6. Handle Mismatch / Increment Attempts
        if not is_match:
            new_attempts = attempts + 1
            remaining = max(0, max_attempts - new_attempts)
            is_locked = (new_attempts >= max_attempts)

            db.orders.update_one(
                {"order_id": order_id},
                {
                    "$set": {
                        "delivery_otp.attempts": new_attempts,
                        "delivery_otp.is_locked": is_locked,
                        "updated_at": now,
                    }
                }
            )

            if is_locked:
                raise ValidationError("Invalid delivery code. Maximum attempts reached. Delivery verification is now locked.")
            raise ValidationError(f"Invalid delivery verification code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.")

        return True

    @staticmethod
    def complete_delivery_atomically(
        order_id: str,
        actor_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Atomically updates the order to DELIVERED, invalidates the OTP for replay prevention,
        and starts the mandatory 48-Hour Buyer Inspection Period.
        Prevents duplicate or concurrent completion via atomic compare-and-swap.
        """
        db = get_db()
        now = datetime.now(timezone.utc)
        inspection_deadline = now + timedelta(hours=settings.INSPECTION_WINDOW_HOURS)

        history_item = {
            "status": OrderStatus.DELIVERED.value,
            "timestamp": now,
            "updated_by": actor_id,
            "note": notes or f"Doorstep delivery completed. Buyer OTP verified. 48-Hour Buyer Inspection Period started (Deadline: {inspection_deadline.strftime('%Y-%m-%d %H:%M UTC')}).",
        }

        # Atomic compare-and-swap: only update if order is in a transit state and delivery_otp is not yet verified
        updated_order = db.orders.find_one_and_update(
            {
                "order_id": order_id,
                "status": {
                    "$in": [
                        OrderStatus.PICKED_UP.value,
                        OrderStatus.IN_TRANSIT.value,
                        OrderStatus.OUT_FOR_DELIVERY.value,
                        "picked_up",
                        "in_transit",
                        "out_for_delivery",
                    ]
                },
                "$or": [
                    {"delivery_otp.verified": False},
                    {"delivery_otp.verified": {"$exists": False}},
                ]
            },
            {
                "$set": {
                    "status": OrderStatus.DELIVERED.value,
                    "delivery_otp.verified": True,
                    "delivery_otp.verified_at": now,
                    "delivery_otp.verified_by": actor_id,
                    "delivery_otp.attempts": 0,
                    "payout_status": PayoutStatus.HELD_INSPECTION.value,
                    "inspection_deadline": inspection_deadline,
                    "inspection_status": "in_inspection",
                    "delivery_timestamp": now,
                    "local_delivery_info.status": "delivered",
                    "local_delivery_info.delivered_at": now,
                    "updated_at": now,
                },
                "$push": {"status_history": history_item}
            },
            return_document=True
        )

        if not updated_order:
            raise ConflictError("Order is already delivered or delivery verification is currently being processed.")

        logger.info(f"[DeliveryOtp] Order {order_id} marked DELIVERED atomically by {actor_id}. 48h Inspection Window active.")
        return updated_order
