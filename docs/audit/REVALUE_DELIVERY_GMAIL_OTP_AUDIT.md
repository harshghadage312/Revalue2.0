# REVALUE — DELIVERY GMAIL OTP AUDIT & ARCHITECTURAL PROPOSAL
**Document**: Delivery OTP Infrastructure Audit  
**Author**: ReValue System Audit Assistant  
**Date**: November 20, 2026  
**Status**: **READ-ONLY AUDIT COMPLETED — AWAITING IMPLEMENTATION APPROVAL**  
**Target File**: `docs/audit/REVALUE_DELIVERY_GMAIL_OTP_AUDIT.md`  

---

## 1. Executive Summary

This audit evaluates the feasibility, security, and architectural design for reusing ReValue's existing **Google Apps Script HTTPS Gmail Gateway** (`revalue26@gmail.com`) to deliver **Buyer Doorstep Delivery Verification OTPs**, without duplicating external email infrastructure or disturbing the existing user registration and authentication OTP workflows.

### Key Audit Conclusions:
1. **Infrastructure Reusability**: The existing Google Apps Script Web App on HTTPS port 443 can be reused with zero new environment variables, zero new third-party accounts, and zero additional cloud costs.
2. **Current Delivery OTP Reality**: Delivery OTPs are currently **NOT sent via email or SMS**. In the local rider flow, the OTP is generated and stored in **plaintext** inside MongoDB `orders.delivery_otp.otp`, and returned in the JSON payload of the tracking API (`GET /orders/{order_id}/tracking`). In the third-party courier flow, the OTP is stored in an in-memory dictionary in `mock_adapter.py`.
3. **Security Vulnerabilities Identified**:
   - Plaintext OTP storage in MongoDB `orders.delivery_otp.otp`.
   - Plaintext OTP exposure in `GET /api/v1/orders/{order_id}/tracking` response.
   - Missing attempt rate-limiting in `RiderService.verify_delivery_otp_and_complete` (unprotected against brute-force attempts).
4. **Clean Logical Separation**: Reusing the HTTPS gateway does **not** conflate authentication and delivery OTPs. They operate on separate database entities (`email_verifications` vs `orders`), have separate lifetimes (5 minutes vs 48 hours), enforce different recipient validations, and serve distinct business functions.
5. **Preservation Guarantee**: Reusing the gateway requires zero modifications to existing delivery status machines, rider compensation workflows, the 48-hour buyer inspection window, escrow fund holding, or admin dispute resolutions.

---

## 2. Existing Registration & Login Gmail OTP Implementation

### 2.1. Architectural Overview
ReValue operates its backend on Render's Free tier, where outbound SMTP ports (`25`, `465`, `587`) are blocked. To achieve reliable transactional email delivery at zero cost, an HTTPS email gateway was built on Google Apps Script:

```
[ FastAPI Backend on Render ]
             │
             │ HTTPS POST (Port 443)
             │ Payload: { action: "send_otp", shared_secret: "...", email, name, otp, expires_in_minutes }
             ▼
[ Google Apps Script Web App ]
  - Authenticates shared_secret in constant time
  - Formats branded responsive HTML & plaintext MIME
  - Calls MailApp.sendEmail() from revalue26@gmail.com
             │
             ▼
[ Recipient Gmail / Inbox ]
```

### 2.2. Configuration & Authentication
- **Gateway Script**: `google_apps_script/Code.gs`
- **Environment Variables**:
  - `APPS_SCRIPT_EMAIL_ENABLED`: `true`
  - `APPS_SCRIPT_EMAIL_URL`: Deployment Web App HTTPS URL
  - `APPS_SCRIPT_SHARED_SECRET`: 64-character random hexadecimal shared secret
- **Sender Account**: `revalue26@gmail.com` (Display Name: `ReValue Marketplace`)
- **Backend Provider Adapter**: `backend/app/services/email_service.py` (`AppsScriptEmailProvider`)
- **HTTP Client**: `httpx.Client(timeout=15.0, follow_redirects=True)`

### 2.3. Security & Validation Controls
- **Generation**: Cryptographically secure 6-digit numeric code via `secrets.randbelow(900000) + 100000`.
- **Storage**: Stored in `db.email_verifications` as HMAC-SHA256 hash (`hash_otp(email, otp)`). The plaintext OTP is never persisted in MongoDB.
- **Expiration**: 5 minutes (`OTP_EXPIRE_MINUTES = 5`).
- **Resend Cooldown**: 60 seconds (`OTP_RESEND_COOLDOWN_SECONDS = 60`).
- **Attempt Limit**: Maximum 5 failed verification attempts before the record is destroyed.
- **Single-Use**: Verification document is immediately deleted upon successful validation (`db.email_verifications.delete_one({"email": email})`).
- **Privacy**: Plaintext OTP is never returned in API responses in production (`dev_otp` is strictly suppressed when `is_production` or `is_email_configured` is true). Logs mask emails using `mask_email()`.

---

## 3. Existing Delivery & Pickup OTP Workflows

ReValue supports two distinct fulfillment modes: **Third-Party Courier** (`DeliveryService`) and **Hybrid Local Rider** (`RiderService`).

### 3.1. Third-Party Courier Flow (`DeliveryService`)
1. **Booking**: Seller books shipment via Shiprocket or Delhivery adapter. A `pickup_token` (e.g. `LOC-PICK-XXXX`) is assigned for courier warehouse manifest tracking.
2. **Handover**: When the seller hands the parcel to the courier, the seller or admin calls `POST /api/v1/orders/{order_id}/handover`.
   - `DeliveryService.confirm_handover` calls `courier_provider.generate_delivery_otp(order_id, buyer_phone)`.
   - In `MockCourierAdapter`: Generates a 6-digit OTP, stores salt and hash in an in-memory dictionary `self._otps[order_id]`.
   - Saves masked OTP (`**34`) into `order["delivery_otp_masked"]`.
   - Inserts an in-app notification to the buyer with the *masked* OTP.
   - **Crucial Finding**: The unmasked OTP is **never sent to the buyer via email or SMS**.
3. **Verification**: When the courier delivers the parcel, `DeliveryService.verify_delivery_otp_and_complete` validates the OTP against the adapter's in-memory record.

### 3.2. Hybrid Local Rider Flow (`RiderService`)
1. **Assignment**: Local rider accepts job from available pool.
2. **Arrival at Pickup**: Rider calls `POST /api/v1/riders/jobs/{job_id}/arrived-pickup`.
3. **Pickup Confirmation**: Rider collects parcel from seller and calls `POST /api/v1/riders/jobs/{job_id}/confirm-pickup`.
   - Generates 6-digit OTP: `otp_plain = f"{secrets.randbelow(900000) + 100000:06d}"`.
   - Saves to `order["delivery_otp"]`:
     ```json
     {
       "otp": "481920",
       "masked": "**20",
       "expires_at": "now + 48 hours",
       "verified": false,
       "generated_at": "now"
     }
     ```
   - **Crucial Finding**: The OTP is saved in **plaintext** inside MongoDB `orders` collection.
   - The unmasked OTP is returned to the buyer via `GET /api/v1/orders/{order_id}/tracking` in the field `buyer_delivery_otp`.
   - **No email or SMS is sent**.
4. **Doorstep Delivery & Verification**:
   - Rider arrives at buyer doorstep and calls `POST /api/v1/riders/jobs/{job_id}/complete` with `entered_otp`.
   - `RiderService.verify_delivery_otp_and_complete` compares `str(entered_otp).strip() == str(order["delivery_otp"]["otp"]).strip()`.
   - Order advances to `delivered`, 48-hour buyer inspection period begins (`inspection_deadline = now + 48h`), payout status advances to `held_inspection`.

### 3.3. Pickup OTP Analysis
- **Current State**: Neither the courier flow nor the local rider flow requires a "Pickup OTP" entered by the seller.
- In both flows, physical pickup is authenticated via:
  - Courier: Handover confirmation by seller/admin logging parcel dispatch.
  - Rider: Rider GPS presence and explicit pickup confirmation call (`confirm_pickup`).
- **Conclusion**: There is no existing seller pickup OTP requiring an email dispatch. The only OTP requiring delivery via Gmail is the **Buyer Doorstep Delivery OTP**.

---

## 4. Current Gap & Vulnerability Analysis

| Vulnerability / Limitation | Location in Code | Security Risk | Proposed Fix |
| :--- | :--- | :--- | :--- |
| **No Out-of-Band Delivery** | `RiderService.confirm_pickup` & `DeliveryService.confirm_handover` | If the buyer is offline or not actively checking the web app, they cannot receive their delivery code when the rider arrives at the door. | Automatically send the delivery OTP to the buyer's registered Gmail via Apps Script upon pickup confirmation. |
| **Plaintext OTP in MongoDB** | `backend/app/services/rider_service.py` (line 453) | Plaintext `delivery_otp.otp` stored directly in `db.orders`. Database readers or backups could leak OTPs. | Hash the delivery OTP using HMAC-SHA256 (`hash_otp(order_id, otp)`) before saving to MongoDB, matching auth OTP security standards. |
| **Plaintext OTP in Tracking API** | `backend/app/services/delivery_service.py` (line 426) | `buyer_otp_plain` returned in public `/tracking` endpoint. Any session or token compromise exposes the code. | Deprecate `buyer_delivery_otp` in API responses for production. Rely strictly on verified Gmail delivery, leaving only `delivery_otp_masked` in the UI. |
| **No Rate Limiting on Rider Verification** | `backend/app/services/rider_service.py` (line 550) | `verify_delivery_otp_and_complete` has no attempt counter; a compromised or malicious rider could brute-force the 6-digit code. | Enforce a strict 5-attempt limit with account lockout and order notification. |
| **In-Memory Storage in Mock Courier** | `backend/app/integrations/courier/mock_adapter.py` (line 374) | Courier OTPs are lost on server restart. | Unify delivery OTP persistence in MongoDB `db.orders` across both courier and local rider flows. |

---

## 5. Proposed Architecture: Reusing the Gmail Gateway for Delivery OTP

### 5.1. Core Architectural Principles
1. **Zero New Credentials**: Reuse the existing `APPS_SCRIPT_EMAIL_URL` and `APPS_SCRIPT_SHARED_SECRET`.
2. **Zero Infrastructure Duplication**: The same Google Apps Script Web App handles both registration and delivery OTPs.
3. **Strict Logical Separation**: Authentication OTPs and Delivery OTPs remain entirely independent in schemas, lifetimes, endpoints, and validation logic.

### 5.2. Proposed Flow Diagram

```
[ Rider confirms pickup / Courier confirms handover ]
                         │
                         ▼
             [ Fetch Order & Buyer ]
  - Verify order is in 'picked_up' state
  - Fetch buyer from db.users where id = order.buyer_id
  - Confirm buyer.is_email_verified is True
  - Retrieve buyer.email and buyer.name
                         │
                         ▼
        [ Generate & Hash Delivery OTP ]
  - Generate 6-digit secure numeric code
  - Store HMAC-SHA256 hash in order.delivery_otp.otp_hash
  - Store masked code (**34) in order.delivery_otp_masked
  - Set expiration: now + 48 hours
  - Set attempts: 0
                         │
                         ▼
      [ Dispatch via Existing Gmail Gateway ]
  - Call EmailService.send_delivery_otp()
  - HTTPS POST to existing APPS_SCRIPT_EMAIL_URL
  - Payload: { action: "send_delivery_otp", email, name, otp, order_id, product_title }
                         │
                         ▼
            [ Google Apps Script Gateway ]
  - Matches action "send_delivery_otp"
  - Generates dedicated Delivery Verification HTML email
  - Dispatches from revalue26@gmail.com
                         │
                         ▼
            [ Buyer's Registered Inbox ]
  - Buyer receives email: "{otp} is your ReValue delivery code for order {order_id}"
  - Buyer gives code to rider only at doorstep after inspecting parcel
```

---

## 6. Logical Separation: Auth OTP vs Delivery OTP

The table below demonstrates how the two OTP subsystems maintain strict domain separation:

| Dimension | Authentication OTP | Delivery Verification OTP |
| :--- | :--- | :--- |
| **Business Objective** | Verifies ownership of an email address to activate a new account. | Verifies physical chain-of-custody transfer of a valuable smartphone at the buyer's doorstep. |
| **Database Collection** | `db.email_verifications` | `db.orders` (under `delivery_otp` sub-document) |
| **Associated Entity** | `email` (User Account) | `order_id` (Order & Escrow Transaction) |
| **Recipient** | Prospective user registering an account. | Authenticated buyer with `is_email_verified = True`. |
| **Sender Action** | `POST /api/v1/auth/register/send-otp` | `POST /api/v1/riders/jobs/{id}/confirm-pickup` or `POST /api/v1/orders/{id}/handover` |
| **Verification Endpoint** | `POST /api/v1/auth/register/verify-otp` | `POST /api/v1/riders/jobs/{id}/complete` or `POST /api/v1/orders/{id}/verify-otp` |
| **Actor Entering OTP** | The user themselves (via web browser). | The **rider or courier agent** (via rider portal or delivery terminal). |
| **Validity Window** | **5 minutes** (`OTP_EXPIRE_MINUTES`) | **48 hours** (transit duration) |
| **Max Retry Attempts** | 5 attempts (deletes verification doc) | 5 attempts (locks order and alerts admin) |
| **Success Action** | Inserts/activates user in `db.users`, returns JWT access & refresh tokens. | Advances order to `delivered`, triggers 48-hour inspection period, holds funds in escrow. |

---

## 7. Email Template Design for Delivery OTP

To ensure clear brand distinction, the delivery OTP email will feature a dedicated template in Google Apps Script rather than reusing the registration message:

### Subject:
`📦 {otp} is your ReValue doorstep delivery code for Order {order_id}`

### Email Content Wireframe:
- **Header**: ReValue Marketplace (`revalue26@gmail.com`)
- **Greeting**: `Hello {buyer_name},`
- **Context Card**:
  - **Item**: `{product_title}`
  - **Order ID**: `{order_id}`
  - **Carrier / Partner**: `{courier_or_rider_name}`
- **Highlighted Code Box**:
  - Big font: `3 9 1 8 2 0`
  - Subtext: `⏱ Valid for your scheduled delivery window (48 hours)`
- **Safety Advisory Card**:
  > **Important Instructions for Delivery:**
  > 1. Keep this code confidential until the delivery partner is standing at your door.
  > 2. Inspect the external shipping box or tamper-evident seal before sharing this code.
  > 3. Never share this code over the phone, SMS, or WhatsApp before the physical package is in your hands.
  > 4. Once the partner enters this code, your **48-Hour Buyer Inspection Period** begins immediately.

---

## 8. Security Hardening & Zero-Leakage Checklist

1. **Strict Buyer Email Resolution**:
   - The email address must **never** be pulled from untrusted client input.
   - Resolved exclusively from `db.users.find_one({"id": order["buyer_id"]})["email"]`.
   - Must verify `buyer.get("is_email_verified") is True`.
2. **Cryptographic Hashing**:
   - Remove plaintext storage: `order["delivery_otp"]["otp"]`.
   - Store: `order["delivery_otp"]["otp_hash"] = hmac.new(key=secret, msg=f"{order_id}:{otp}".encode(), digestmod=hashlib.sha256).hexdigest()`.
3. **API Response Sanitization**:
   - `order_tracking` response: Set `buyer_delivery_otp = None` in production. Only expose `delivery_otp_masked: "**34"`.
   - Rider job APIs: Ensure `delivery_otp_hash` and `delivery_otp` are stripped (already confirmed in `RiderService._sanitize_job_doc`).
4. **Brute-Force Protection**:
   - Add `attempts: int` counter in `order["delivery_otp"]`.
   - Increment on each failed verification in `verify_delivery_otp_and_complete`.
   - If `attempts >= 5`, reject with `HTTP 429 Too Many Attempts` and require admin/support unlock.
5. **Log Masking**:
   - Never log raw 6-digit delivery OTPs.
   - Use `mask_email(buyer_email)` and `f"**{otp[-2:]}"` in all server log messages.

---

## 9. Preservation & Compatibility Matrix

| Feature / Subsystem | Current Status | Impact of Proposed Delivery OTP Reusage |
| :--- | :--- | :--- |
| **Registration / Login OTP** | 100% Operational via Apps Script | **Zero Impact**. Existing `action: "send_otp"` remains untouched. |
| **Google Apps Script Config** | `APPS_SCRIPT_EMAIL_URL` and `SHARED_SECRET` in Render | **Zero Impact**. Uses exact same URL and secret. |
| **Order Status Workflow** | `shipment_booked` → `picked_up` → `delivered` | **Zero Impact**. Transitions triggered at exact same lifecycle points. |
| **Rider Portal UI** | Rider enters OTP on `RiderJobDetailPage.tsx` | **Zero Impact**. Rider continues to input the 6 digits provided by buyer. |
| **48-Hour Buyer Inspection** | Starts upon OTP verification | **Zero Impact**. Inspection deadline calculated and escrow preserved. |
| **Escrow & Payout System** | Payout status `held_inspection` | **Zero Impact**. Payout release rules remain completely untouched. |
| **Admin Dispute Console** | Full dispute lifecycle | **Zero Impact**. Disputes continue to block payouts as designed. |

---

## 10. Phased Implementation Roadmap (For Approval)

Once authorized, implementation will follow these safe, non-breaking steps:

### Phase A: Google Apps Script Web App Enhancement (`Code.gs`)
1. Add `action === "send_delivery_otp"` handler to `google_apps_script/Code.gs`.
2. Implement `buildDeliveryHtmlEmail(name, otp, order_id, product_title)` with security guidelines.
3. Deploy new version in Google Apps Script editor under existing Web App deployment.
4. Verify using a test script that pings `action: "send_delivery_otp"`.

### Phase B: Backend Email Provider Extension (`backend/app/services/email_service.py`)
1. Add `AppsScriptEmailProvider.send_delivery_otp(email, name, otp, order_id, product_title)`.
2. Add `EmailService.send_delivery_otp(...)` with fallback simulation in local development.
3. Add unit test suite in `test_apps_script_email.py` verifying request structure and error handling.

### Phase C: Delivery & Rider Service Integration
1. Update `RiderService.confirm_pickup`:
   - Generate OTP, store HMAC hash and masked code.
   - Call `EmailService.send_delivery_otp` targeting `buyer["email"]`.
2. Update `DeliveryService.confirm_handover`:
   - Replace in-memory mock storage with persistent hashed storage in `order["delivery_otp"]`.
   - Call `EmailService.send_delivery_otp` targeting `buyer["email"]`.
3. Update `RiderService.verify_delivery_otp_and_complete` and `DeliveryService.verify_delivery_otp_and_complete`:
   - Add 5-attempt rate-limit guard.
   - Compare HMAC hash using `hmac.compare_digest`.
4. Sanitize `DeliveryService.get_order_tracking`:
   - Suppress plaintext OTP in production responses.

### Phase D: Automated Testing & Verification
1. Run full backend pytest suite (all 80+ tests).
2. Run frontend production build and unit tests.
3. End-to-end sandbox verification of local rider and courier delivery lifecycles.

---

## 11. Recommendation & Sign-Off

> [!NOTE]
> **Audit Conclusion**: Reusing ReValue's existing Google Apps Script Gmail Gateway for Delivery Verification OTPs is **technically sound, cost-free, improves security posture, and resolves the missing out-of-band delivery channel**.
>
> In accordance with instructions, **zero code, database records, environment variables, or production configurations have been modified during this audit**.

**Status**: Ready for review and awaiting user authorization before proceeding with implementation.
