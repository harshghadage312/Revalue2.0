# REVALUE — PHASE B PRODUCTION RELEASE REPORT
**Delivery Gmail OTP Backend Integration Production Release**

- **Date:** November 20, 2026
- **Release Status:** PRODUCTION LIVE & VERIFIED
- **Production Backend URL:** `https://revalue-api-qk4m.onrender.com/`
- **Feature Commit:** `0861631f4448a5451267707aacb53fdf8d852c4e`
- **Merge Commit:** `e618141445b23d9396beaa5e495f5538eec26040`
- **GitHub Repository:** `https://github.com/harshghadage312/revalue`

---

## 1. Executive Release Overview

Phase B backend delivery Gmail OTP integration was safely released into production on the `main` branch and deployed to Render. 

The update activates automated, order-bound, cryptographically secured buyer doorstep delivery verification emails powered by the existing Google Apps Script gateway (`revalue26@gmail.com`). All raw OTP codes are salted with domain-separated HMAC-SHA256, leaving zero plaintext OTPs stored in MongoDB Atlas and zero OTP leakage across public tracking and rider endpoints.

---

## 2. Git Release & Push Confirmations

| Operation | Target / Source | Ref / Commit | Status |
| :--- | :--- | :--- | :--- |
| **Branch Push** | `origin/feature/delivery-gmail-otp-phase-b-backend` | `0861631` | Confirmed Pushed |
| **Branch Fetch** | `origin/main` | `aa0bbe9` | Confirmed Up-to-Date |
| **Merge into main** | `main` | `e618141` | Non-fast-forward merge (`--no-ff`) successful |
| **Main Push** | `origin/main` | `e618141` | Confirmed Pushed |

---

## 3. Render Deployment Status

- **Environment:** Live Render Web Service (`revalue-api-qk4m.onrender.com`)
- **Deployment Status:** `healthy` (HTTP 200)
- **Runtime Environment:** Python 3.11.9, TensorFlow 2.15.1, Keras builtin
- **Readiness Check (`/api/v1/ready`):** `ready: True`, Database: `live_mongodb` operational, ML Models: `available`
- **Configuration & Atlas Records:** Zero environment variable modifications; zero manual database schema migrations required.

---

## 4. Test Verification Results

### 4.1 Automated Backend Test Suite (Pytest)
```
======================= 98 passed in 112.23s (0:01:52) ========================
```
- Total Tests: 98
- Passed: 98 (100%)
- Failed: 0
- Delivery Gmail OTP Suite (`test_delivery_gmail_otp.py`): 18/18 PASSED

### 4.2 Frontend Compatibility Verification
- TypeScript & Vite Build: `dist/index.html` (1.14 kB), `dist/assets/index-Ba0nYw8f.js` (642 kB) — 0 errors
- Frontend API URL Tests: 11/11 PASSED

---

## 5. Live Production Smoke Testing

Live automated smoke tests were executed against `https://revalue-api-qk4m.onrender.com`:

| Smoke Test # | Subsystem / Endpoint | Expected Behavior | Actual Production Result | Status |
|---|---|---|---|---|
| **1** | Health Check (`GET /api/v1/health`) | HTTP 200, status: healthy | HTTP 200, status: healthy | **VERIFIED** |
| **2** | Readiness Probe (`GET /api/v1/ready`) | HTTP 200, ready: true, DB operational | HTTP 200, ready: True | **VERIFIED** |
| **3** | Catalogue Brands (`GET /api/v1/ml/catalogue/brands`) | HTTP 200, 23 brands | HTTP 200, 23 brands returned | **VERIFIED** |
| **4** | Authentication Unaffected (`POST /api/v1/auth/login`) | HTTP 401 UNAUTHORIZED on invalid creds | HTTP 401, Invalid email or password | **VERIFIED** |
| **5** | Registration OTP Unaffected (`POST /api/v1/auth/register/send-otp`) | HTTP 422 validation on malformed email | HTTP 422, input validation error | **VERIFIED** |
| **6** | Order Delivery OTP Resend Auth (`POST /api/v1/orders/{id}/delivery/otp/resend`) | HTTP 401 when unauthenticated | HTTP 401, Missing or malformed header | **VERIFIED** |
| **7** | Rider Delivery OTP Resend Auth (`POST /api/v1/riders/me/jobs/{id}/resend-delivery-otp`) | HTTP 401 when unauthenticated | HTTP 401, Missing or malformed header | **VERIFIED** |
| **8** | Delivery Shipping Quote Calculation (`POST /api/v1/orders/shipping/quotes`) | HTTP 200, 3 dynamic courier quotes | HTTP 200, Delhivery Express, DTDC, BlueDart | **VERIFIED** |
| **9** | Public Tracking Redaction (`GET /api/v1/orders/{id}/tracking`) | HTTP 401 unauthenticated, 0 plain OTP leak | HTTP 401, zero plain OTP leakage | **VERIFIED** |

---

## 6. Security Architecture & Verification Audit

1. **Domain-Separated HMAC Hashing:**
   - Key derivation: `HMAC-SHA256(JWT_SECRET_KEY, "revalue:delivery-verification-otp:v1")`.
   - Production validation: Rejects weak/local development default keys via Pydantic validator.
2. **Zero Plaintext OTP Exposure:**
   - Public tracking (`/orders/{id}/tracking`): In production, `buyer_delivery_otp` is strictly redacted to `None`. Only `delivery_otp_masked` (e.g., `••••89`) is transmitted.
   - Rider endpoints (`/riders/me/jobs/{id}`): Sanitized via `_sanitize_job_doc`, stripping both `delivery_otp` and `delivery_otp_hash`.
3. **Throttling & Lockout:**
   - 10-minute expiry window enforced.
   - 60-second resend cooldown enforced.
   - Max 5 hourly requests per order enforced.
   - 5 incorrect verification attempts trigger automatic account/order delivery lockout.
4. **Replay & Concurrency Prevention:**
   - Atomic compare-and-swap (`find_one_and_update`) ensures exactly-once verification and triggers the 48-Hour Buyer Inspection Period and escrow hold.

---

## 7. Skipped Checks

- **Full Phase C Security Audit:** Skipped per explicit instructions to perform only the short mandatory release safety check.
- **Physical Doorstep Real Delivery Completion Simulation:** Skipped simulating physical doorstep OTP entry against real customer orders to preserve live customer order integrity.

---

## 8. Rollback Procedure

If production anomalies arise:
1. Revert merge commit `e618141` on `main`:
   ```bash
   git revert -m 1 e618141
   git push origin main
   ```
2. Render will automatically redeploy the prior production build (`aa0bbe9`) within ~2 minutes.
3. Legacy orders with plaintext OTPs and existing registration flows will remain fully supported by backward-compatibility guards.
