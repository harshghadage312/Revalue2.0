import uuid
import hmac
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import Depends, Header
from app.db.connection import get_db
from app.core.config import settings
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, generate_secure_token
)
from app.core.errors import (
    AppException, ConflictError, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError
)
from app.schemas.auth import (
    UserRegisterRequest, UserLoginRequest, TokenResponse,
    UserProfileResponse, UpdateProfileRequest,
    RegisterSendOtpRequest, RegisterSendOtpResponse,
    RegisterVerifyOtpRequest, RegisterVerifyOtpResponse
)
from app.services.email_service import EmailService, mask_email
from app.core.logging import logger


def hash_otp(email: str, otp: str) -> str:
    """HMAC-SHA256 hash of email:otp using JWT_SECRET_KEY for zero-plaintext storage."""
    key = settings.JWT_SECRET_KEY.encode("utf-8")
    message = f"{email.lower().strip()}:{otp.strip()}".encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


class AuthService:
    @staticmethod
    def send_registration_otp(req: RegisterSendOtpRequest) -> RegisterSendOtpResponse:
        """
        Validates user registration details, generates a cryptographically secure 6-digit OTP,
        stores its HMAC-SHA256 hash and bcrypt-hashed password in MongoDB with a 5-minute expiry,
        and sends the verification email via Gmail SMTP.
        """
        db = get_db()
        email = req.email.lower().strip()

        # Security check: Only buyer and seller roles are allowed through public OTP registration
        if req.role not in ["buyer", "seller"]:
            raise ValidationError("Only 'buyer' and 'seller' accounts may be created through public registration.")

        # Check existing user in users collection
        existing_user = db.users.find_one({"email": email})
        if existing_user and existing_user.get("is_email_verified", True) is not False:
            raise ConflictError("An account with this email address already exists. Please sign in.")

        now = datetime.now(timezone.utc)

        # Rate limiting & resend cooldown check on pending verification
        pending = db.email_verifications.find_one({"email": email})
        if pending:
            resend_time = pending.get("resend_available_at")
            if resend_time:
                if resend_time.tzinfo is None:
                    resend_time = resend_time.replace(tzinfo=timezone.utc)
                if now < resend_time:
                    remaining_sec = max(1, int((resend_time - now).total_seconds()))
                    raise ValidationError(f"Please wait {remaining_sec} seconds before requesting a new verification code.")

            # Hourly rate limit (max 5 requests per hour)
            created_at = pending.get("created_at")
            if created_at and created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            if created_at and (now - created_at) < timedelta(hours=1):
                request_count = pending.get("request_count", 1)
                if request_count >= 5:
                    raise ValidationError("Maximum OTP request limit reached. Please wait an hour before requesting again.")
                new_request_count = request_count + 1
            else:
                new_request_count = 1
        else:
            new_request_count = 1

        # Cryptographically secure 6-digit OTP (100000 - 999999)
        otp = f"{secrets.randbelow(900000) + 100000}"
        otp_hash = hash_otp(email, otp)
        pw_hash = hash_password(req.password)

        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
        resend_available_at = now + timedelta(seconds=settings.OTP_RESEND_COOLDOWN_SECONDS)

        # Store in email_verifications collection with zero plaintext secrets
        verif_doc = {
            "_id": email,
            "email": email,
            "name": req.name.strip(),
            "password_hash": pw_hash,
            "role": req.role,
            "otp_hash": otp_hash,
            "attempts": 0,
            "request_count": new_request_count,
            "resend_available_at": resend_available_at,
            "expires_at": expires_at,
            "created_at": now,
            "updated_at": now,
        }
        db.email_verifications.replace_one({"email": email}, verif_doc, upsert=True)

        # Send OTP email via EmailService
        email_sent, error_reason = EmailService.send_registration_otp(email, req.name, otp)
        if not email_sent:
            if settings.is_production:
                logger.error(f"Production OTP email failed for {mask_email(email)}: {error_reason}")
                raise AppException(
                    message=f"Failed to dispatch verification email: {error_reason or 'Please verify system email settings.'}",
                    code="EMAIL_DELIVERY_FAILED",
                    status_code=503,
                )
            logger.warning(f"Registration OTP email delivery failed for {mask_email(email)}: {error_reason}")

        resp = RegisterSendOtpResponse(
            message=f"A 6-digit verification code has been sent to {email}.",
            email=email,
            cooldown_seconds=settings.OTP_RESEND_COOLDOWN_SECONDS,
            expires_in_minutes=settings.OTP_EXPIRE_MINUTES,
        )

        # Strictly never expose OTP in production or when an email provider is configured
        if not settings.is_production and not settings.is_email_configured:
            resp.dev_otp = otp

        return resp

    @staticmethod
    def verify_registration_otp(req: RegisterVerifyOtpRequest) -> RegisterVerifyOtpResponse:
        """
        Validates the submitted OTP against the stored HMAC hash, enforces attempt limits
        and expiration, activates or creates the user in db.users with is_email_verified=True,
        and returns access and refresh JWT tokens for automatic login.
        """
        db = get_db()
        email = req.email.lower().strip()
        otp = req.otp.strip()

        verif_record = db.email_verifications.find_one({"email": email})
        if not verif_record:
            raise ValidationError("No pending registration found for this email. Please request a new verification code.")

        now = datetime.now(timezone.utc)
        expires_at = verif_record.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if not expires_at or now > expires_at:
            db.email_verifications.delete_one({"email": email})
            raise ValidationError("Verification code has expired. Please request a new code.")

        attempts = verif_record.get("attempts", 0)
        if attempts >= settings.OTP_MAX_ATTEMPTS:
            db.email_verifications.delete_one({"email": email})
            raise ValidationError("Maximum verification attempts exceeded. Please request a new code.")

        expected_hash = hash_otp(email, otp)
        stored_hash = verif_record.get("otp_hash", "")

        # Constant-time comparison to prevent timing side-channel attacks
        if not hmac.compare_digest(stored_hash, expected_hash):
            new_attempts = attempts + 1
            remaining = settings.OTP_MAX_ATTEMPTS - new_attempts
            if remaining <= 0:
                db.email_verifications.delete_one({"email": email})
                raise ValidationError("Invalid verification code. Maximum attempts reached. Please request a new code.")
            db.email_verifications.update_one({"email": email}, {"$set": {"attempts": new_attempts, "updated_at": now}})
            raise ValidationError(f"Invalid verification code. {remaining} attempt{'s' if remaining > 1 else ''} remaining.")

        # OTP is valid! Invalidate verification record immediately
        db.email_verifications.delete_one({"email": email})

        # Create or activate user in db.users
        existing_user = db.users.find_one({"email": email})
        if existing_user:
            db.users.update_one(
                {"email": email},
                {"$set": {
                    "is_email_verified": True,
                    "is_active": True,
                    "password_hash": verif_record["password_hash"],
                    "name": verif_record["name"],
                    "updated_at": now,
                }}
            )
            user_doc = db.users.find_one({"email": email})
        else:
            user_id = str(uuid.uuid4())
            user_doc = {
                "_id": user_id,
                "id": user_id,
                "name": verif_record["name"],
                "email": email,
                "password_hash": verif_record["password_hash"],
                "role": verif_record["role"],
                "is_active": True,
                "is_email_verified": True,
                "phone": None,
                "address": None,
                "created_at": now,
                "updated_at": now,
                "average_rating": 0.0,
                "review_count": 0,
            }
            db.users.insert_one(user_doc)

        logger.info(f"User {user_doc['id']} ({mask_email(email)}) verified email and activated account.")

        # Issue JWT Access and Refresh Tokens
        token_payload = {
            "sub": user_doc["id"],
            "email": user_doc["email"],
            "role": user_doc["role"],
        }
        access_token = create_access_token(token_payload)
        refresh_token, jti, expire_time = create_refresh_token(token_payload)

        db.refresh_tokens.insert_one({
            "_id": jti,
            "jti": jti,
            "user_id": user_doc["id"],
            "token": refresh_token,
            "expires_at": expire_time,
            "is_revoked": False,
            "created_at": now,
        })

        user_profile = UserProfileResponse(
            id=user_doc["id"],
            name=user_doc["name"],
            email=user_doc["email"],
            role=user_doc["role"],
            is_active=user_doc.get("is_active", True),
            phone=user_doc.get("phone"),
            address=user_doc.get("address"),
            created_at=user_doc["created_at"],
            average_rating=user_doc.get("average_rating", 0.0),
            review_count=user_doc.get("review_count", 0),
        )

        return RegisterVerifyOtpResponse(
            message="Email successfully verified. Welcome to ReValue!",
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user=user_profile,
        )

    @staticmethod
    def register_user(req: UserRegisterRequest, default_verified: bool = True) -> UserProfileResponse:
        """Direct registration endpoint (retained for backward compatibility and test fixtures)."""
        db = get_db()
        email = req.email.lower().strip()

        # Security check: Prevent unauthorized self-assignment of rider and admin roles
        if req.role == "rider":
            raise ValidationError("Direct registration as delivery partner ('rider') is disallowed. Please use the /riders/register flow.")
        if req.role == "admin" and settings.ENVIRONMENT == "production":
            raise ForbiddenError("Self-registration as administrator is not permitted in production.")

        # Check existing user
        if db.users.find_one({"email": email}):
            raise ConflictError(f"User with email '{email}' already exists.")

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        hashed_pw = hash_password(req.password)

        user_doc = {
            "_id": user_id,
            "id": user_id,
            "name": req.name.strip(),
            "email": email,
            "password_hash": hashed_pw,
            "role": req.role,
            "is_active": True,
            "is_email_verified": default_verified,
            "phone": None,
            "address": None,
            "created_at": now,
            "updated_at": now,
            "average_rating": 0.0,
            "review_count": 0,
        }
        db.users.insert_one(user_doc)
        logger.info(f"Registered new user {user_id} with role '{req.role}'")

        return UserProfileResponse(
            id=user_id,
            name=user_doc["name"],
            email=user_doc["email"],
            role=user_doc["role"],
            is_active=user_doc["is_active"],
            phone=user_doc["phone"],
            address=user_doc["address"],
            created_at=user_doc["created_at"],
            average_rating=0.0,
            review_count=0,
        )

    @staticmethod
    def login_user(req: UserLoginRequest) -> TokenResponse:
        db = get_db()
        email = req.email.lower().strip()
        user = db.users.find_one({"email": email})

        if not user or not verify_password(req.password, user["password_hash"]):
            raise UnauthorizedError("Invalid email or password.")

        if not user.get("is_active", True):
            raise ForbiddenError("Account is inactive or disabled.")

        # Require verified email for regular users; preserve legacy users, admins, and riders
        if user.get("is_email_verified") is False and user.get("role") not in ["admin", "rider"]:
            raise ForbiddenError("Email verification required. Please verify your email before logging in.")

        token_payload = {
            "sub": user["id"],
            "email": user["email"],
            "role": user["role"],
        }
        access_token = create_access_token(token_payload)
        refresh_token, jti, expire_time = create_refresh_token(token_payload)

        # Store refresh token record for revocation & rotation tracking
        db.refresh_tokens.insert_one({
            "_id": jti,
            "jti": jti,
            "user_id": user["id"],
            "token": refresh_token,
            "expires_at": expire_time,
            "is_revoked": False,
            "created_at": datetime.now(timezone.utc),
        })

        user_profile = UserProfileResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            is_active=user.get("is_active", True),
            phone=user.get("phone"),
            address=user.get("address"),
            created_at=user["created_at"],
            average_rating=user.get("average_rating", 0.0),
            review_count=user.get("review_count", 0),
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user=user_profile,
        )

    @staticmethod
    def refresh_access_token(refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type. Refresh token required.")

        jti = payload.get("jti")
        user_id = payload.get("sub")
        db = get_db()

        token_record = db.refresh_tokens.find_one({"jti": jti, "is_revoked": False})
        if not token_record:
            raise UnauthorizedError("Refresh token has been revoked or is invalid.")

        user = db.users.find_one({"id": user_id})
        if not user or not user.get("is_active", True):
            raise UnauthorizedError("User account not found or disabled.")

        if user.get("is_email_verified") is False and user.get("role") not in ["admin", "rider"]:
            raise ForbiddenError("Email verification required. Please verify your email before logging in.")

        # Revoke old refresh token (Token Rotation)
        db.refresh_tokens.update_one({"jti": jti}, {"$set": {"is_revoked": True}})

        token_payload = {
            "sub": user["id"],
            "email": user["email"],
            "role": user["role"],
        }
        new_access_token = create_access_token(token_payload)
        new_refresh_token, new_jti, new_expire = create_refresh_token(token_payload)

        db.refresh_tokens.insert_one({
            "_id": new_jti,
            "jti": new_jti,
            "user_id": user["id"],
            "token": new_refresh_token,
            "expires_at": new_expire,
            "is_revoked": False,
            "created_at": datetime.now(timezone.utc),
        })

        user_profile = UserProfileResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            is_active=user.get("is_active", True),
            phone=user.get("phone"),
            address=user.get("address"),
            created_at=user["created_at"],
            average_rating=user.get("average_rating", 0.0),
            review_count=user.get("review_count", 0),
        )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="Bearer",
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user=user_profile,
        )

    @staticmethod
    def logout_token(refresh_token: str):
        try:
            payload = decode_token(refresh_token)
            jti = payload.get("jti")
            if jti:
                db = get_db()
                db.refresh_tokens.update_one({"jti": jti}, {"$set": {"is_revoked": True}})
        except Exception:
            pass  # Fail gracefully on logout

    @staticmethod
    def request_password_reset(email: str) -> Dict[str, Any]:
        """
        Initiates a secure password reset workflow:
        1. Normalizes email and applies rate limiting (60s cooldown & 5 requests/hr).
        2. Always returns a generic response to prevent account enumeration.
        3. If user exists and is active, generates a cryptographically secure token.
        4. Stores ONLY the SHA-256 hash of the token in MongoDB with a 15-minute expiry.
        5. Invalidates previous unconsumed reset tokens for the user.
        6. Dispatches branded HTML reset email via Google Apps Script gateway.
        """
        db = get_db()
        email = email.lower().strip()
        now = datetime.now(timezone.utc)
        generic_msg = "If an account exists with this email, you will receive a password reset link."

        # 1. Rate limiting & Cooldown check
        one_hour_ago = now - timedelta(hours=1)
        recent_resets = list(
            db.password_resets.find({"email": email, "created_at": {"$gte": one_hour_ago}})
            .sort("created_at", -1)
        )

        if recent_resets:
            # Check resend cooldown (60 seconds)
            latest = recent_resets[0]
            latest_time = latest.get("created_at")
            if latest_time:
                if latest_time.tzinfo is None:
                    latest_time = latest_time.replace(tzinfo=timezone.utc)
                elapsed_seconds = (now - latest_time).total_seconds()
                cooldown_window = settings.PASSWORD_RESET_COOLDOWN_SECONDS
                if elapsed_seconds < cooldown_window:
                    remaining = max(1, int(cooldown_window - elapsed_seconds))
                    raise ValidationError(f"Please wait {remaining} seconds before requesting another password reset link.")

            # Check hourly request ceiling (max 5)
            if len(recent_resets) >= settings.PASSWORD_RESET_MAX_HOURLY_REQUESTS:
                raise ValidationError("Maximum password reset request limit reached for this email. Please wait an hour before requesting again.")

        # 2. Check if user exists
        user = db.users.find_one({"email": email})

        # To prevent account enumeration, if user does not exist or is inactive,
        # record a throttler entry and return the identical generic success response
        if not user or user.get("is_active") is False:
            db.password_resets.insert_one({
                "_id": str(uuid.uuid4()),
                "token_hash": None,
                "user_id": None,
                "email": email,
                "expires_at": now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
                "used": True,
                "created_at": now,
            })
            return {
                "message": generic_msg,
                "cooldown_seconds": settings.PASSWORD_RESET_COOLDOWN_SECONDS,
            }

        user_id = user.get("id") or str(user.get("_id", ""))

        # 3. Invalidate any previously issued active tokens for this user
        db.password_resets.update_many(
            {"$or": [{"user_id": user_id}, {"email": email}], "used": False},
            {"$set": {"used": True, "invalidated_at": now}}
        )

        # 4. Generate secure token & SHA-256 hash (Zero Plaintext Token Storage)
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)

        db.password_resets.insert_one({
            "_id": str(uuid.uuid4()),
            "token_hash": token_hash,
            "user_id": user_id,
            "email": email,
            "expires_at": expires_at,
            "used": False,
            "created_at": now,
        })

        # 5. Build frontend reset URL
        frontend_base = settings.effective_frontend_url.rstrip("/")
        reset_url = f"{frontend_base}/reset-password?token={raw_token}"

        # 6. Dispatch branded email via EmailService (Google Apps Script gateway)
        display_name = user.get("full_name") or user.get("name") or "Valued Member"
        try:
            EmailService.send_password_reset(
                email=email,
                name=display_name,
                reset_url=reset_url,
                expires_in_minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES,
            )
        except Exception as ex:
            logger.error(f"[AuthService] Password reset dispatch failed for {mask_email(email)}: {type(ex).__name__}")

        logger.info(f"Password reset link generated and dispatched for user {user_id} (masked: {mask_email(email)})")

        response_data = {
            "message": generic_msg,
            "cooldown_seconds": settings.PASSWORD_RESET_COOLDOWN_SECONDS,
        }

        # Safe development/testing simulation: include dev token only when in local dev & email unconfigured
        if not settings.is_production and not settings.is_apps_script_configured:
            response_data["dev_reset_token"] = raw_token
            response_data["dev_reset_url"] = reset_url

        return response_data

    @staticmethod
    def reset_password(token: str, new_password: str) -> Dict[str, Any]:
        """
        Validates the submitted reset token, checks expiration, atomically consumes it,
        and securely updates the user's password using bcrypt.
        """
        db = get_db()
        now = datetime.now(timezone.utc)

        clean_token = str(token or "").strip()
        if not clean_token:
            raise ValidationError("Password reset token is required.")

        clean_password = str(new_password or "").strip()
        if len(clean_password) < 8 or len(clean_password) > 128:
            raise ValidationError("Password must be between 8 and 128 characters long.")

        token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()

        # Atomic compare-and-swap consumption:
        # Matches token_hash (or legacy plaintext token for backward compatibility)
        record = db.password_resets.find_one_and_update(
            {
                "$or": [
                    {"token_hash": token_hash},
                    {"token": clean_token}
                ],
                "used": False,
                "expires_at": {"$gt": now}
            },
            {
                "$set": {
                    "used": True,
                    "used_at": now,
                    "updated_at": now
                }
            },
            return_document=True
        )

        if not record:
            # Diagnose specific reason for user-friendly error message
            existing = db.password_resets.find_one({
                "$or": [
                    {"token_hash": token_hash},
                    {"token": clean_token}
                ]
            })
            if not existing:
                raise ValidationError("Password reset link is invalid or has expired.")
            if existing.get("used"):
                raise ValidationError("This password reset link has already been used. Please request a new one.")
            exp = existing.get("expires_at")
            if exp:
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp <= now:
                    raise ValidationError("This password reset link has expired. Please request a new one.")
            raise ValidationError("Password reset link is invalid or has expired.")

        user_id = record.get("user_id")
        user = None
        if user_id:
            user = db.users.find_one({"$or": [{"id": user_id}, {"_id": user_id}]})
        if not user and record.get("email"):
            user = db.users.find_one({"email": record.get("email")})

        if not user or user.get("is_active") is False:
            raise ValidationError("Account is inactive or not found.")

        # Hash new password using existing bcrypt method
        hashed_pw = hash_password(clean_password)
        db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password_hash": hashed_pw,
                    "updated_at": now,
                    "password_reset_at": now
                }
            }
        )

        # Invalidate all remaining reset tokens for this account
        db.password_resets.update_many(
            {"$or": [{"user_id": user_id}, {"email": record.get("email")}], "used": False},
            {"$set": {"used": True, "invalidated_at": now}}
        )

        # Invalidate existing active refresh tokens/sessions for security
        effective_uid = user.get("id") or str(user.get("_id", ""))
        db.refresh_tokens.update_many(
            {"$or": [{"user_id": user_id}, {"user_id": effective_uid}]},
            {"$set": {"is_revoked": True}}
        )

        logger.info(f"Password successfully reset for user {effective_uid}")
        return {"message": "Your password has been successfully reset. Please log in with your new password."}


# FastAuth dependencies
def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Missing or malformed Authorization header.")

    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type. Access token required.")

    user_id = payload.get("sub")
    db = get_db()
    user = db.users.find_one({"id": user_id})
    if not user:
        raise UnauthorizedError("User associated with token no longer exists.")
    if not user.get("is_active", True):
        raise ForbiddenError("Account is inactive.")
    if user.get("is_email_verified") is False and user.get("role") not in ["admin", "rider"]:
        raise ForbiddenError("Email verification required. Please verify your email before accessing this resource.")
    return user


def require_role(required_role: str):
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        # Admin can access all endpoints; otherwise check user's role
        if current_user.get("role") == "admin" or current_user.get("role") == required_role:
            return current_user
        raise ForbiddenError(f"Action requires '{required_role}' permissions.")
    return role_checker
