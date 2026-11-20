import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from app.db.connection import get_db
from app.core.security import hash_password
from app.core.errors import (
    ConflictError, UnauthorizedError, NotFoundError, ForbiddenError, ValidationError
)
from app.core.logging import logger
from app.schemas.riders import (
    RiderRegisterRequest, RiderProfileResponse, RiderLocationUpdateRequest,
    DeliveryJobResponse, DeliveryJobCompensation
)


class RiderService:
    @staticmethod
    def _mask_identifier(val: Optional[str]) -> Optional[str]:
        if not val:
            return None
        clean = val.strip()
        if len(clean) <= 4:
            return "****"
        return f"{clean[:2]}-*****{clean[-4:]}"

    @staticmethod
    def register_rider(req: RiderRegisterRequest) -> Dict[str, Any]:
        db = get_db()
        email = req.email.lower().strip()
        phone = req.phone.strip()

        # Check existing user
        if db.users.find_one({"email": email}):
            raise ConflictError(f"User with email '{email}' already exists.")

        if db.rider_profiles.find_one({"phone": phone}):
            raise ConflictError(f"Delivery partner with phone number '{phone}' is already registered.")

        user_id = str(uuid.uuid4())
        rider_id = f"rider_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        hashed_pw = hash_password(req.password)

        # 1. Create User Document with role 'rider'
        user_doc = {
            "_id": user_id,
            "id": user_id,
            "name": req.name.strip(),
            "email": email,
            "password_hash": hashed_pw,
            "role": "rider",
            "is_active": True,
            "phone": phone,
            "address": req.city.strip(),
            "created_at": now,
            "updated_at": now,
            "average_rating": 5.0,
            "review_count": 0,
        }
        db.users.insert_one(user_doc)

        # 2. Create Rider Profile Document
        masked_license = RiderService._mask_identifier(req.driving_license_number)
        rider_doc = {
            "_id": rider_id,
            "id": rider_id,
            "user_id": user_id,
            "name": req.name.strip(),
            "email": email,
            "phone": phone,
            "city": req.city.strip(),
            "service_pincodes": [p.strip() for p in req.service_pincodes if p.strip()],
            "vehicle_type": req.vehicle_type,
            "vehicle_registration_number": req.vehicle_registration_number.strip().upper() if req.vehicle_registration_number else None,
            "driving_license_masked": masked_license,
            "driving_license_hash": hash_password(req.driving_license_number) if req.driving_license_number else None,
            "emergency_contact_name": req.emergency_contact_name.strip() if req.emergency_contact_name else None,
            "emergency_contact_phone": req.emergency_contact_phone.strip() if req.emergency_contact_phone else None,
            "application_status": "pending",  # Requires admin approval
            "rejection_reason": None,
            "suspension_reason": None,
            "is_online": False,
            "last_location": None,
            "last_active_at": None,
            "created_at": now,
            "approved_at": None,
            "total_deliveries_completed": 0,
            "average_rating": 5.0,
        }
        db.rider_profiles.insert_one(rider_doc)

        logger.info(f"Registered new delivery partner {rider_id} ({email}) - Status: PENDING")

        return {
            "message": "Delivery partner registration submitted successfully. Your application is under review.",
            "rider_id": rider_id,
            "user_id": user_id,
            "application_status": "pending"
        }

    @staticmethod
    def get_profile_by_user(user_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Delivery partner profile not found.")
        r_copy = dict(rider)
        if "_id" in r_copy:
            r_copy["_id"] = str(r_copy["_id"])
        r_copy.pop("driving_license_hash", None)
        r_copy["rating"] = float(r_copy.get("average_rating", 5.0))
        r_copy["successful_deliveries"] = int(r_copy.get("total_deliveries_completed", 0))
        r_copy["total_deliveries"] = int(r_copy.get("total_deliveries_completed", 0))
        r_copy["current_location"] = r_copy.get("last_location")
        return r_copy

    @staticmethod
    def get_profile_by_id(rider_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"id": rider_id})
        if not rider:
            raise NotFoundError("Delivery partner not found.")
        r_copy = dict(rider)
        if "_id" in r_copy:
            r_copy["_id"] = str(r_copy["_id"])
        r_copy.pop("driving_license_hash", None)
        r_copy["rating"] = float(r_copy.get("average_rating", 5.0))
        r_copy["successful_deliveries"] = int(r_copy.get("total_deliveries_completed", 0))
        r_copy["total_deliveries"] = int(r_copy.get("total_deliveries_completed", 0))
        r_copy["current_location"] = r_copy.get("last_location")
        return r_copy

    @staticmethod
    def get_job_detail(user_id: str, job_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Delivery partner not found.")

        job = db.delivery_jobs.find_one({"id": job_id})
        if not job:
            raise NotFoundError("Delivery job not found.")

        j_copy = dict(job)
        if "_id" in j_copy:
            j_copy["_id"] = str(j_copy["_id"])
        j_copy.pop("delivery_otp_hash", None)
        j_copy.pop("delivery_otp", None)
        return j_copy

    @staticmethod
    def update_online_status(user_id: str, is_online: bool) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Delivery partner profile not found.")

        if rider.get("application_status") != "approved":
            status_desc = rider.get("application_status", "pending")
            raise ForbiddenError(
                f"Cannot toggle operational availability. Account status is currently '{status_desc}'. "
                "Only administrator-approved delivery partners can go online."
            )

        now = datetime.now(timezone.utc)
        db.rider_profiles.update_one(
            {"id": rider["id"]},
            {"$set": {"is_online": is_online, "last_active_at": now}}
        )
        logger.info(f"Rider {rider['id']} toggled online status to {is_online}")
        return RiderService.get_profile_by_user(user_id)

    @staticmethod
    def update_location(user_id: str, req: RiderLocationUpdateRequest) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Delivery partner profile not found.")

        if rider.get("application_status") != "approved":
            raise ForbiddenError("Account not approved for delivery.")

        now = datetime.now(timezone.utc)
        location_data = {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "pincode": req.pincode,
            "updated_at": now
        }
        db.rider_profiles.update_one(
            {"id": rider["id"]},
            {"$set": {
                "last_location": location_data,
                "last_active_at": now
            }}
        )
        return {"status": "updated", "last_active_at": now}

    @staticmethod
    def list_available_jobs(user_id: str) -> List[Dict[str, Any]]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Delivery partner profile not found.")

        if rider.get("application_status") != "approved":
            raise ForbiddenError("Application under review. Job access restricted until approved.")

        if not rider.get("is_online", False):
            return []  # Offline riders receive no jobs

        rider_pincodes = rider.get("service_pincodes", [])
        rider_city = rider.get("city", "").lower()

        # Find jobs in 'searching' or 'offered' state that match rider pincodes or city
        # And haven't been rejected by this rider
        now = datetime.now(timezone.utc)
        query = {
            "status": {"$in": ["searching", "offered"]},
            "rejected_by_rider_ids": {"$ne": rider["id"]},
            "$or": [
                {"pickup_pincode": {"$in": rider_pincodes}},
                {"delivery_pincode": {"$in": rider_pincodes}},
                {"pickup_city": rider_city},
                {"delivery_city": rider_city}
            ]
        }

        jobs_cursor = db.delivery_jobs.find(query).sort("created_at", -1).limit(20)
        jobs = []
        for j in jobs_cursor:
            # Privacy safe: do not leak full phone or exact buyer flat before acceptance
            safe_job = {
                "id": j["id"],
                "order_id": j["order_id"],
                "product_title": j.get("product_title", "Pre-Owned Smartphone"),
                "status": j["status"],
                "delivery_type": j.get("delivery_type", "revalue_local"),
                "pickup_area": f"{j.get('pickup_address', {}).get('city', '')} ({j.get('pickup_pincode', '')})",
                "delivery_area": f"{j.get('delivery_address', {}).get('city', '')} ({j.get('delivery_pincode', '')})",
                "pickup_pincode": j.get("pickup_pincode"),
                "delivery_pincode": j.get("delivery_pincode"),
                "package_weight_kg": j.get("package_weight_kg", 0.5),
                "declared_value": j.get("declared_value", 0.0),
                "is_cod": j.get("is_cod", False),
                "cod_amount": j.get("cod_amount", 0.0),
                "compensation": j.get("compensation", {}),
                "created_at": j.get("created_at"),
            }
            jobs.append(safe_job)
        return jobs

    @staticmethod
    def get_active_job(user_id: str) -> Optional[Dict[str, Any]]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Delivery partner profile not found.")

        active_job = db.delivery_jobs.find_one({
            "assigned_rider_id": rider["id"],
            "status": {"$in": ["accepted", "arriving_at_pickup", "picked_up", "out_for_delivery"]}
        })
        return active_job

    @staticmethod
    def accept_job(user_id: str, job_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider or rider.get("application_status") != "approved":
            raise ForbiddenError("Only approved delivery partners can accept delivery jobs.")

        if not rider.get("is_online", False):
            raise ValidationError("You must be online to accept assignments.")

        # Ensure rider does not already have an active uncompleted job
        existing_active = db.delivery_jobs.find_one({
            "assigned_rider_id": rider["id"],
            "status": {"$in": ["accepted", "arriving_at_pickup", "picked_up", "out_for_delivery"]}
        })
        if existing_active:
            raise ValidationError("You already have an active delivery in progress. Complete it before accepting another.")

        now = datetime.now(timezone.utc)

        # Atomic find_one_and_update to prevent race condition between multiple riders!
        updated_job = db.delivery_jobs.find_one_and_update(
            {
                "id": job_id,
                "status": {"$in": ["searching", "offered"]}
            },
            {
                "$set": {
                    "status": "accepted",
                    "assigned_rider_id": rider["id"],
                    "assigned_rider_name": rider["name"],
                    "assigned_rider_phone": rider["phone"],
                    "accepted_at": now,
                    "updated_at": now
                },
                "$push": {
                    "timeline": {
                        "status": "accepted",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": f"Job accepted by delivery partner {rider['name']}."
                    }
                }
            },
            return_document=True
        )

        if not updated_job:
            raise ConflictError("Job has already been accepted by another delivery partner or is no longer available.")

        # Also update linked order status
        db.orders.update_one(
            {"order_id": updated_job["order_id"]},
            {
                "$set": {
                    "local_delivery_info.assigned_rider_id": rider["id"],
                    "local_delivery_info.assigned_rider_name": rider["name"],
                    "local_delivery_info.status": "accepted",
                    "local_delivery_info.accepted_at": now
                },
                "$push": {
                    "status_history": {
                        "status": "seller_dispatch_pending",
                        "timestamp": now,
                        "updated_by": f"rider_{rider['name']}",
                        "note": f"ReValue local partner {rider['name']} assigned. Preparing for seller pickup."
                    }
                }
            }
        )

        logger.info(f"Rider {rider['id']} atomically accepted job {job_id} for order {updated_job['order_id']}")
        return updated_job

    @staticmethod
    def reject_job(user_id: str, job_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        now = datetime.now(timezone.utc)
        # Add to rejected list so rider is not offered again
        db.delivery_jobs.update_one(
            {"id": job_id},
            {
                "$addToSet": {"rejected_by_rider_ids": rider["id"]},
                "$push": {
                    "timeline": {
                        "status": "rejected_by_rider",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": f"Offer declined by rider {rider['name']}."
                    }
                }
            }
        )
        return {"status": "rejected", "job_id": job_id}

    @staticmethod
    def mark_arrived_pickup(user_id: str, job_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        now = datetime.now(timezone.utc)
        job = db.delivery_jobs.find_one_and_update(
            {
                "id": job_id,
                "assigned_rider_id": rider["id"],
                "status": "accepted"
            },
            {
                "$set": {"status": "arriving_at_pickup", "arrived_at_pickup_time": now, "updated_at": now},
                "$push": {
                    "timeline": {
                        "status": "arriving_at_pickup",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": "Rider arrived at seller pickup location."
                    }
                }
            },
            return_document=True
        )
        if not job:
            raise ValidationError("Job not found or not in accepted state.")
        return job

    @staticmethod
    def confirm_pickup(user_id: str, job_id: str, notes: Optional[str] = None) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        now = datetime.now(timezone.utc)
        job = db.delivery_jobs.find_one_and_update(
            {
                "id": job_id,
                "assigned_rider_id": rider["id"],
                "status": {"$in": ["accepted", "arriving_at_pickup"]}
            },
            {
                "$set": {
                    "status": "picked_up",
                    "picked_up_at": now,
                    "pickup_notes": notes,
                    "updated_at": now
                },
                "$push": {
                    "timeline": {
                        "status": "picked_up",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": notes or "Physical package collected from seller. Entering local transit."
                    }
                }
            },
            return_document=True
        )
        if not job:
            raise ValidationError("Job not found or not ready for pickup confirmation.")

        # Sync with order and generate/dispatch secure buyer doorstep delivery OTP
        from app.services.delivery_otp_service import DeliveryOtpService
        order = db.orders.find_one({"order_id": job["order_id"]})
        if order:
            db.orders.update_one(
                {"order_id": job["order_id"]},
                {
                    "$set": {
                        "status": "picked_up",
                        "shipment_info.is_courier_verified": True,
                        "local_delivery_info.status": "picked_up",
                        "local_delivery_info.picked_up_at": now
                    },
                    "$push": {
                        "status_history": {
                            "status": "picked_up",
                            "timestamp": now,
                            "updated_by": f"rider_{rider['name']}",
                            "note": f"Parcel collected by local partner {rider['name']}. Doorstep delivery OTP dispatched to buyer."
                        }
                    }
                }
            )
            # Dispatch secure HMAC delivery OTP via Google Apps Script Gmail gateway
            DeliveryOtpService.generate_and_dispatch_delivery_otp(
                order_id=job["order_id"],
                actor_id=rider["id"],
                carrier_name=f"ReValue Local Partner ({rider['name']})"
            )

        return job

    @staticmethod
    def start_delivery(user_id: str, job_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        now = datetime.now(timezone.utc)
        job = db.delivery_jobs.find_one_and_update(
            {
                "id": job_id,
                "assigned_rider_id": rider["id"],
                "status": "picked_up"
            },
            {
                "$set": {"status": "out_for_delivery", "out_for_delivery_at": now, "updated_at": now},
                "$push": {
                    "timeline": {
                        "status": "out_for_delivery",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": "Rider is en route to buyer doorstep."
                    }
                }
            },
            return_document=True
        )
        if not job:
            raise ValidationError("Job not found or not in picked_up state.")

        # Update order status
        db.orders.update_one(
            {"order_id": job["order_id"]},
            {
                "$set": {"status": "out_for_delivery", "local_delivery_info.status": "out_for_delivery"},
                "$push": {
                    "status_history": {
                        "status": "out_for_delivery",
                        "timestamp": now,
                        "updated_by": f"rider_{rider['name']}",
                        "note": f"Local delivery partner {rider['name']} is out for doorstep delivery."
                    }
                }
            }
        )
        return job

    @staticmethod
    def verify_delivery_otp_and_complete(
        user_id: str,
        job_id: str,
        entered_otp: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        job = db.delivery_jobs.find_one({"id": job_id, "assigned_rider_id": rider["id"]})
        if not job:
            raise NotFoundError("Delivery job not found.")

        if job["status"] not in ["out_for_delivery", "picked_up"]:
            raise ValidationError(f"Cannot complete delivery for job in '{job['status']}' state.")

        order = db.orders.find_one({"order_id": job["order_id"]})
        if not order:
            raise NotFoundError("Associated order not found.")

        # Verify Doorstep Delivery OTP via centralized DeliveryOtpService
        from app.services.delivery_otp_service import DeliveryOtpService
        DeliveryOtpService.verify_delivery_otp(
            order_id=job["order_id"],
            entered_otp=entered_otp,
            actor_id=rider["id"]
        )

        now = datetime.now(timezone.utc)

        # 1. Update Job Status to Delivered
        updated_job = db.delivery_jobs.find_one_and_update(
            {"id": job_id},
            {
                "$set": {
                    "status": "delivered",
                    "delivered_at": now,
                    "delivery_notes": notes,
                    "updated_at": now,
                    "compensation.payout_status": "eligible"  # Eligible for payout release
                },
                "$push": {
                    "timeline": {
                        "status": "delivered",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": "Doorstep delivery completed. Buyer OTP verified successfully."
                    }
                }
            },
            return_document=True
        )

        # 2. Update Order to DELIVERED atomically and start 48h Inspection Window
        DeliveryOtpService.complete_delivery_atomically(
            order_id=job["order_id"],
            actor_id=f"rider_{rider['name']}",
            notes=notes or f"Package delivered by {rider['name']} and verified via OTP. 48-Hour Buyer Inspection Period is active."
        )

        # 3. Increment Rider Completed Deliveries Counter
        db.rider_profiles.update_one(
            {"id": rider["id"]},
            {
                "$inc": {"total_deliveries_completed": 1},
                "$set": {"last_active_at": now}
            }
        )

        logger.info(f"Rider {rider['id']} successfully delivered order {job['order_id']} via OTP verification.")
        return updated_job

    @staticmethod
    def resend_delivery_otp(user_id: str, job_id: str) -> Dict[str, Any]:
        """
        Allows delivery partner to request a fresh delivery verification code at buyer's doorstep.
        Enforces 60-second cooldown and dispatches to buyer's verified registered email.
        """
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        job = db.delivery_jobs.find_one({"id": job_id, "assigned_rider_id": rider["id"]})
        if not job:
            raise NotFoundError("Delivery job not found.")

        from app.services.delivery_otp_service import DeliveryOtpService
        return DeliveryOtpService.generate_and_dispatch_delivery_otp(
            order_id=job["order_id"],
            actor_id=rider["id"],
            is_resend=True,
            carrier_name=f"ReValue Local Partner ({rider['name']})"
        )

    @staticmethod
    def report_failure(user_id: str, job_id: str, reason: str, notes: Optional[str] = None) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        now = datetime.now(timezone.utc)
        job = db.delivery_jobs.find_one_and_update(
            {
                "id": job_id,
                "assigned_rider_id": rider["id"]
            },
            {
                "$set": {
                    "status": "delivery_failed",
                    "failure_reason": reason,
                    "failure_notes": notes,
                    "failed_at": now,
                    "updated_at": now
                },
                "$push": {
                    "timeline": {
                        "status": "delivery_failed",
                        "timestamp": now,
                        "actor_id": rider["id"],
                        "actor_role": "rider",
                        "notes": f"Delivery exception: {reason}. {notes or ''}"
                    }
                }
            },
            return_document=True
        )
        if not job:
            raise ValidationError("Job not found or not assigned to this rider.")

        # Update order with exception notice
        db.orders.update_one(
            {"order_id": job["order_id"]},
            {
                "$push": {
                    "status_history": {
                        "status": "in_transit",
                        "timestamp": now,
                        "updated_by": f"rider_{rider['name']}",
                        "note": f"Delivery attempt failed ({reason}). ReValue operations notified."
                    }
                }
            }
        )
        return job

    @staticmethod
    def get_rider_earnings(user_id: str) -> Dict[str, Any]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        jobs_cursor = db.delivery_jobs.find({
            "assigned_rider_id": rider["id"],
            "status": "delivered"
        })

        total_earned = 0.0
        eligible_payout = 0.0
        paid_payout = 0.0
        pending_payout = 0.0
        completed_jobs_count = 0

        earnings_jobs = []
        for j in jobs_cursor:
            comp = j.get("compensation", {})
            amt = float(comp.get("total_compensation", comp.get("total_rider_earnings", 0.0)))
            p_status = comp.get("payout_status", "pending")
            total_earned += amt
            completed_jobs_count += 1

            if p_status == "paid":
                paid_payout += amt
            elif p_status in ["eligible", "processing"]:
                eligible_payout += amt
            else:
                pending_payout += amt

            earnings_jobs.append({
                "job_id": j.get("id"),
                "order_id": j.get("order_id"),
                "product_title": j.get("product_title", "Pre-Owned Smartphone"),
                "completed_at": str(j.get("delivered_at") or j.get("updated_at")),
                "compensation": comp
            })

        return {
            "rider_id": rider["id"],
            "rider_name": rider["name"],
            "total_earned": round(total_earned, 2),
            "total_earnings_inr": round(total_earned, 2),
            "eligible_for_payout_inr": round(eligible_payout, 2),
            "paid_out": round(paid_payout, 2),
            "paid_payout_inr": round(paid_payout, 2),
            "pending_payout": round(pending_payout, 2),
            "pending_payout_inr": round(pending_payout, 2),
            "completed_jobs_count": completed_jobs_count,
            "total_deliveries_completed": completed_jobs_count,
            "currency": "INR",
            "jobs": earnings_jobs
        }

    @staticmethod
    def get_rider_history(user_id: str) -> List[Dict[str, Any]]:
        db = get_db()
        rider = db.rider_profiles.find_one({"user_id": user_id})
        if not rider:
            raise NotFoundError("Rider profile not found.")

        cursor = db.delivery_jobs.find({
            "assigned_rider_id": rider["id"]
        }).sort("updated_at", -1).limit(50)

        history = []
        for j in cursor:
            history.append({
                "id": j["id"],
                "order_id": j["order_id"],
                "product_title": j.get("product_title", "Pre-Owned Smartphone"),
                "status": j["status"],
                "pickup_area": f"{j.get('pickup_address', {}).get('city', '')} ({j.get('pickup_pincode', '')})",
                "delivery_area": f"{j.get('delivery_address', {}).get('city', '')} ({j.get('delivery_pincode', '')})",
                "compensation": j.get("compensation", {}),
                "created_at": j.get("created_at"),
                "delivered_at": j.get("delivered_at")
            })
        return history
