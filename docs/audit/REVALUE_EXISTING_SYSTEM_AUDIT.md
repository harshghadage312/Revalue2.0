# ReValue — Pre-Implementation Safety & Existing System Audit

**Audit Date**: November 19, 2026  
**Project**: ReValue — AI-Assisted Resale Marketplace for Pre-Owned Smartphones  
**Academic Context**: Final-Year B.Tech Capstone Project (AI/ML + Full-Stack Architecture)  
**Target Repository**: [harshghadage312/revalue](https://github.com/harshghadage312/revalue)  
**Working Directory**: `C:\Users\Harshad\.gemini\antigravity\scratch\revalue`  
**Production URLs**:
- Frontend: [https://revalue-nine.vercel.app/](https://revalue-nine.vercel.app/)
- Backend: [https://revalue-api-qk4m.onrender.com/](https://revalue-api-qk4m.onrender.com/)
- OpenAPI Docs: [https://revalue-api-qk4m.onrender.com/api/docs](https://revalue-api-qk4m.onrender.com/api/docs)

---

## 1. Current Git State & Revision History

- **Current Active Branch**: `main`
- **Head Commit**: `95acbc21558c8ba36cdd9cf46d19b4b7480297cc`
- **Commit Subject**: `feat(email): integrate Google Apps Script HTTPS email gateway for production delivery`
- **Remote Synchronization**: Fully up to date with `origin/main`
- **Branch Topology**:
  - `main`: Production release branch.
  - `feature/email-otp-registration`: Implemented Gmail OTP registration flow.
  - `feature/hybrid-local-delivery`: Implemented local rider governance, pin-code routing, and doorstep OTP.
  - `feature/production-delivery-system`: Removed legacy mocks, hardened escrow settlement.
  - `brand-identity-upgrade` / `ui-polish-mobile-upgrade`: Professional e-commerce marketplace frontend.
  - Checkpoint branches: `backup/delivery-system-checkpoint`, `backup/pre-hybrid-delivery-main`.

---

## 2. Architecture Overview

### 2.1 Backend Architecture (FastAPI Modular Architecture)
The backend is structured as a modular, enterprise-grade Python application following clean separation of concerns:
```
backend/
├── main.py                     # FastAPI application factory, CORS, exception handlers, router mounts
├── requirements.txt            # Locked dependencies (FastAPI, PyMongo, TensorFlow, Scikit-learn, etc.)
└── app/
    ├── api/v1/                 # 13 Versioned REST API Controllers
    │   ├── admin.py            # Fleet governance, COD reconciliation, dispute resolution, metrics
    │   ├── auctions.py         # Sealed bidding auctions and finalization
    │   ├── auth.py             # User registration, OTP send/verify, login, refresh, profile
    │   ├── delivery.py         # Delivery quotes, serviceability, tracking, courier webhooks
    │   ├── health.py           # /api/health and /api/ready readiness probe
    │   ├── ml.py               # AI condition evaluation & price prediction endpoints
    │   ├── notifications.py    # In-app notification delivery and read status
    │   ├── offers.py           # Open negotiation offers, counters, accept/reject
    │   ├── orders.py           # Escrow orders, inspection window approval/disputes
    │   ├── payments.py         # Razorpay & Sandbox payment intent creation and webhooks
    │   ├── products.py         # Product listings, multi-photo upload, search, verification
    │   ├── reviews.py          # User & order reviews, ratings, reporting
    │   ├── riders.py           # Delivery partner registration, live jobs, status, earnings
    │   └── wishlist.py         # Buyer wishlist management
    ├── core/                   # Security, configuration, and logging
    │   ├── config.py           # Pydantic Settings with strict production validation
    │   ├── errors.py           # Normalized AppException hierarchy & handlers
    │   ├── logging.py          # Structured standard library logging
    │   └── security.py         # Passlib/Bcrypt, PyJWT, token generation, constant-time compare
    ├── db/                     # MongoDB persistence layer
    │   ├── connection.py       # Live MongoClient with thread-safe in-memory dev/test fallback
    │   └── indexes.py          # Automated unique, compound, and TTL index initializers
    ├── integrations/           # Pluggable external adapters
    │   ├── courier/            # Base interface, Mock adapter, Shiprocket adapter
    │   └── payments/           # Base interface, Sandbox adapter, Razorpay provider
    ├── models/                 # Domain entities and status enums
    ├── schemas/                # Pydantic v2 validation contracts
    ├── services/               # Core business logic domain services
    │   ├── admin_service.py
    │   ├── auction_service.py
    │   ├── auth_service.py
    │   ├── delivery_service.py
    │   ├── email_service.py    # AppsScriptEmailProvider & SmtpEmailProvider
    │   ├── hybrid_routing_service.py
    │   ├── negotiation.py
    │   ├── offer_service.py
    │   ├── order_service.py
    │   ├── product_service.py
    │   ├── review_service.py
    │   ├── rider_service.py
    │   └── wishlist_service.py
    └── tests/                  # 80 Automated Pytest unit and integration tests
```

### 2.2 Frontend Architecture (React 19 + TypeScript + Vite + Tailwind CSS)
```
frontend/
├── package.json                # React 19, TypeScript 6, Vite 8, Tailwind CSS v4, Lucide icons
├── vite.config.ts              # Vite frontend build pipeline
├── vercel.json                 # Vercel edge reverse proxy routing /api/* to Render backend
└── src/
    ├── App.tsx                 # Client-side hash router with role-based route guard
    ├── main.tsx                # React DOM entry point
    ├── components/             # Reusable UI widgets
    │   ├── AiConditionModal.tsx      # Interactive MobileNet condition camera scanner
    │   ├── AiPriceValuatorModal.tsx  # ML resale price estimation interactive dialog
    │   ├── AuthModal.tsx             # Two-step registration modal with live 6-digit OTP
    │   ├── BrandLogo.tsx             # ReValue brand mark
    │   ├── Navbar.tsx                # Role-aware responsive navigation bar
    │   ├── Footer.tsx                # Branded e-commerce footer
    │   └── ProductCard.tsx           # Listing card with condition badges & pricing
    ├── context/
    │   └── AuthContext.tsx           # React authentication context with JWT refresh
    ├── pages/                        # 16 Comprehensive role-specific marketplace views
    │   ├── LandingPage.tsx
    │   ├── MarketplacePage.tsx
    │   ├── ProductDetailPage.tsx
    │   ├── CreateListingPage.tsx
    │   ├── BuyerDashboard.tsx
    │   ├── SellerDashboard.tsx
    │   ├── CheckoutPage.tsx
    │   ├── DeliveryTrackingPage.tsx
    │   ├── AdminDashboard.tsx
    │   ├── DeliveryPartnerSignupPage.tsx
    │   ├── DeliveryPartnerApplicationStatusPage.tsx
    │   ├── RiderDashboard.tsx
    │   ├── RiderJobsPage.tsx
    │   ├── RiderJobDetailPage.tsx
    │   ├── RiderEarningsPage.tsx
    │   └── RiderProfilePage.tsx
    ├── services/
    │   └── api.ts                    # Fully-typed fetch client covering all backend endpoints
    └── types/
        └── index.ts                  # Shared TypeScript interfaces
```

---

## 3. Inventory of All 116 Backend API Endpoints

The backend exposes **116 registered REST API endpoints** organized under OpenAPI tags:

| Category / Tag | Endpoints Count | Key Routes |
|---|---|---|
| **Health & Diagnostics** | 4 | `GET /api/health`, `GET /api/ready`, `GET /api/v1/health`, `GET /api/v1/ready` |
| **Authentication & Profile** | 9 | `POST /api/v1/auth/register`, `POST /api/v1/auth/register/send-otp`, `POST /api/v1/auth/register/verify-otp`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `PUT /api/v1/auth/me`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password` |
| **Product Listings** | 10 | `GET /api/v1/products`, `POST /api/v1/products`, `GET /api/v1/products/my-listings`, `GET /api/v1/products/search`, `GET /api/v1/products/{id}`, `PUT /api/v1/products/{id}`, `DELETE /api/v1/products/{id}`, `POST /api/v1/products/{id}/photos`, `POST /api/v1/products/{id}/verify`, `POST /api/v1/products/{id}/archive` |
| **AI & Machine Learning** | 8 | `POST /api/v1/ml/price-prediction`, `POST /api/v1/ml/mobile-condition`, `POST /api/v1/ml/price-range`, `GET /api/v1/ml/catalogue`, `GET /api/v1/ml/catalogue/brands`, `GET /api/v1/ml/catalogue/models`, `GET /api/v1/ml/catalogue/specs`, `GET /api/v1/recommendations` |
| **Open Negotiation** | 7 | `POST /api/v1/offers`, `GET /api/v1/offers/received`, `GET /api/v1/offers/sent`, `GET /api/v1/offers/{id}`, `POST /api/v1/offers/{id}/accept`, `POST /api/v1/offers/{id}/reject`, `POST /api/v1/offers/{id}/counter` |
| **Sealed Bidding Auctions** | 5 | `GET /api/v1/auctions`, `GET /api/v1/auctions/product/{product_id}`, `GET /api/v1/auctions/{id}`, `POST /api/v1/auctions/{id}/bids`, `POST /api/v1/auctions/{id}/finalize` |
| **Orders & Escrow** | 8 | `POST /api/v1/orders`, `GET /api/v1/orders/buying`, `GET /api/v1/orders/selling`, `GET /api/v1/orders/{id}`, `POST /api/v1/orders/{id}/cancel`, `POST /api/v1/orders/{id}/inspect-pass`, `POST /api/v1/orders/{id}/inspect-fail`, `POST /api/v1/orders/{id}/dispute` |
| **Payments** | 4 | `POST /api/v1/payments/create-intent`, `POST /api/v1/payments/verify`, `POST /api/v1/payments/webhook`, `GET /api/v1/payments/order/{order_id}` |
| **Hybrid Delivery & Tracking** | 5 | `POST /api/v1/delivery/quote`, `GET /api/v1/delivery/serviceability`, `GET /api/v1/delivery/jobs`, `GET /api/v1/delivery/track/{order_id}`, `POST /api/v1/courier/webhook/{provider}` |
| **Delivery Partners (Riders)** | 22 | `POST /api/v1/riders/register`, `GET /api/v1/riders/me/profile`, `POST /api/v1/riders/me/status`, `POST /api/v1/riders/me/location`, `GET /api/v1/riders/me/jobs/available`, `GET /api/v1/riders/me/jobs/active`, `POST /api/v1/riders/me/jobs/{id}/accept`, `POST /api/v1/riders/me/jobs/{id}/arrived-pickup`, `POST /api/v1/riders/me/jobs/{id}/pickup`, `POST /api/v1/riders/me/jobs/{id}/start-delivery`, `POST /api/v1/riders/me/jobs/{id}/verify-delivery-otp`, `POST /api/v1/riders/me/jobs/{id}/report-failure`, `GET /api/v1/riders/me/earnings`, `GET /api/v1/riders/me/history` (with legacy aliases) |
| **Admin & Fleet Governance** | 25 | `GET /api/v1/admin/metrics`, `GET /api/v1/admin/users`, `PUT /api/v1/admin/users/{id}/status`, `GET /api/v1/admin/riders`, `GET /api/v1/admin/riders/{id}`, `PUT /api/v1/admin/riders/{id}/status`, `GET /api/v1/admin/riders/compensation/ledger`, `PUT /api/v1/admin/riders/compensation/{id}/payout`, `GET /api/v1/admin/service-areas`, `POST /api/v1/admin/service-areas`, `PUT /api/v1/admin/service-areas/{id}`, `DELETE /api/v1/admin/service-areas/{id}`, `GET /api/v1/admin/dispatch/jobs`, `POST /api/v1/admin/dispatch/jobs/{id}/reassign`, `POST /api/v1/admin/dispatch/jobs/{id}/cancel`, `GET /api/v1/admin/cod/reconciliation`, `POST /api/v1/admin/cod/reconcile`, `GET /api/v1/admin/disputes`, `POST /api/v1/admin/disputes/{id}/resolve`, `GET /api/v1/admin/shipments`, `GET /api/v1/admin/reported-reviews`, `DELETE /api/v1/admin/reviews/{id}` |
| **Reviews & Ratings** | 3 | `POST /api/v1/reviews`, `GET /api/v1/reviews/user/{id}`, `POST /api/v1/reviews/{id}/report` |
| **Wishlist** | 3 | `GET /api/v1/wishlist`, `POST /api/v1/wishlist/{product_id}`, `DELETE /api/v1/wishlist/{product_id}` |
| **Notifications** | 2 | `GET /api/v1/notifications`, `PUT /api/v1/notifications/{id}/read` |

---

## 4. MongoDB Database Schema & Index Inventory

ReValue operates on **17 distinct collections** in MongoDB Atlas (`settings.MONGODB_DB_NAME = "revalue_db"`). Indexes are automatically initialized via [`app/db/indexes.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/db/indexes.py):

| Collection | Schema Purpose | Indexes & Integrity Constraints |
|---|---|---|
| `users` | Buyer, Seller, Rider, and Admin accounts | `email` (Unique), `role` |
| `refresh_tokens` | Secure JWT rotation & revocation | `jti` (Unique), `user_id`, `expires_at` |
| `email_verifications` | OTP verification staging with zero plaintext | `email` (Unique), `expires_at` (TTL auto-cleanup), `created_at` |
| `password_resets` | Cryptographic password reset tokens | `token` (Unique), `user_id`, `expires_at` |
| `products` | Pre-owned smartphone inventory | `seller_id`, `status`, `selling_method`, compound `(category, asking_price)`, `created_at` |
| `offers` | Bilateral negotiation threads & counters | `product_id`, `buyer_id`, `seller_id`, `status` |
| `auctions` | Sealed-bid auction metadata | `product_id` (Unique), `seller_id`, `status`, `deadline` |
| `bids` | Private sealed bids submitted by buyers | `auction_id`, `buyer_id`, compound `(auction_id, amount DESC)` |
| `orders` | Escrow transactions & settlement state | `order_id` (Unique), `buyer_id`, `seller_id`, `product_id`, `status` |
| `payments` | Razorpay payment records & webhook logs | `payment_id` (Unique), `order_id` |
| `reviews` | Buyer/Seller post-order feedback | compound `(order_id, reviewer_id)` (Unique), `target_user_id` |
| `wishlists` | Buyer saved listings | compound `(user_id, product_id)` (Unique) |
| `notifications` | In-app user notifications | `user_id`, `created_at` |
| `disputes` | Escrow hold disputes & resolutions | `order_id` |
| `rider_profiles` | Delivery partner applications & live fleet | `id` (Unique), `user_id` (Unique), `phone` (Unique), `application_status`, `is_online`, `service_pincodes`, `city` |
| `delivery_jobs` | Local dispatch tasks & doorstep OTPs | `id` (Unique), `order_id` (Unique), `status`, `assigned_rider_id`, `pickup_pincode`, `delivery_pincode` |
| `service_areas` | Active hyperlocal delivery zones | `id` (Unique), `city`, `is_active`, `pincodes` |

---

## 5. Machine Learning Models, Artifacts & Pipelines

The repository contains **two complete, trained, production-ready AI models** with full metadata and standalone inference engines:

### 5.1 MobileNetV2 Condition Classification
- **Artifacts**:
  - [`ml/mobile_condition/artifacts/mobilenet_condition.keras`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/artifacts/mobilenet_condition.keras)
  - [`ml/mobile_condition/artifacts/mobilenet_condition.h5`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/artifacts/mobilenet_condition.h5)
  - [`ml/mobile_condition/artifacts/condition_metadata.json`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/artifacts/condition_metadata.json)
  - [`ml/mobile_condition/artifacts/labels.json`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/artifacts/labels.json)
- **Architecture**: Deep Convolutional Neural Network using **MobileNetV2** base with custom classification head.
- **Input Dimensions**: `[224, 224, 3]`, normalized to `[-1.0, 1.0]`.
- **Target Classes**: 4 classes (`0: excellent`, `1: good`, `2: bad`, `3: defective`).
- **Inference Pipeline**: [`ml/mobile_condition/predict.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/predict.py) loads the `.keras` model, runs preprocessing in [`preprocess.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/preprocess.py), and outputs confidence scores, predicted condition, and defect flags.
- **API Endpoint**: `POST /api/v1/ml/mobile-condition` (accepts multipart image file).

### 5.2 MindValue Random Forest Resale Price Estimator
- **Artifacts**:
  - [`ml/price_prediction/artifacts/mindvalue_random_forest_model.pkl`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/artifacts/mindvalue_random_forest_model.pkl)
  - [`ml/price_prediction/artifacts/rf_price_model.joblib`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/artifacts/rf_price_model.joblib)
  - [`ml/price_prediction/artifacts/model_metadata.json`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/artifacts/model_metadata.json)
- **Algorithm**: `RandomForestRegressor(n_estimators=200, random_state=42)`.
- **Feature Vector**: 17 structured smartphone features:
  `['Brand', 'Model', 'OS', 'RAM_GB', 'Storage_GB', 'Battery_mAh', 'Display_Size_Inches', 'Refresh_Rate_Hz', '5G_Support', 'Original_Price_INR', 'Days_Used', 'Condition', 'Battery_Health_Percent', 'Screen_Crack', 'Scratches', 'Repair_History', 'Warranty_Available']`
- **Dataset Coverage**: 26 smartphone brands, 754 distinct phone models.
- **Inference Pipeline**: [`ml/price_prediction/predict.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/predict.py) extracts features, applies one-hot / categorical encoding, and produces fair market resale valuations with lower/upper confidence bounds.
- **API Endpoint**: `POST /api/v1/ml/price-prediction` and `POST /api/v1/ml/price-range`.

### 5.3 Smart Smartphone Catalogue Service
- Module: [`ml/price_prediction/catalogue.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/catalogue.py)
- Features: Autocompletes technical specifications (RAM, storage, battery, display, launch price) across Apple, Samsung, OnePlus, Xiaomi, Realme, Vivo, Google Pixel, and Motorola models.

### 5.4 Collaborative / Content Recommendation Engine
- Module: [`ml/recommendations/recommender.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/recommendations/recommender.py)
- API Endpoint: `GET /api/v1/recommendations`.

---

## 6. Authentication & Google Apps Script Gmail Gateway

- **Registration Workflow**:
  1. User enters name, email, password, and selects role (`buyer` or `seller`).
  2. Frontend invokes `POST /api/v1/auth/register/send-otp`.
  3. Backend generates cryptographically secure 6-digit OTP via Python `secrets`.
  4. Stores HMAC-SHA256 hash in `email_verifications` with 5-minute expiry and 60-second cooldown.
  5. Password is hashed with bcrypt before storing. Plaintext password and plaintext OTP are **never stored**.
  6. Backend dispatches OTP email via [`AppsScriptEmailProvider`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/email_service.py#L140-L245) over HTTPS (Port 443) to Google Apps Script.
  7. Google Apps Script [`google_apps_script/Code.gs`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/google_apps_script/Code.gs) validates the shared secret via `ScriptProperties` and dispatches via `MailApp.sendEmail` from `revalue26@gmail.com`.
  8. User enters 6-digit code on frontend; backend validates hash via `POST /api/v1/auth/register/verify-otp`.
  9. On success, user account is created with `is_email_verified=True`, and access/refresh JWT tokens are issued.
- **Port 443 Compatibility**: Bypasses Render Free Tier outbound SMTP blocks on ports 25, 465, and 587.

---

## 7. Marketplace & Delivery Workflows

1. **Dual Selling Methods**:
   - **Direct Fixed Price / Open Negotiation**: Sellers list with asking price. Buyers can submit offers; sellers can accept, reject, or counteroffer.
   - **Sealed-Bid Auctions**: Sellers set auction deadline and minimum reserve price. Bids are cryptographically blind until deadline; highest bidder automatically wins.
2. **Escrow & Buyer Protection**:
   - Buyer payment is held in escrow.
   - Seller dispatches parcel (via Hyperlocal Rider or Courier).
   - Upon doorstep handover, a 6-digit delivery OTP is verified.
   - A 48-hour buyer inspection window begins. If the device passes inspection, funds are released to the seller. If a dispute is raised, funds remain locked in escrow until admin adjudication.
3. **Hyperlocal Delivery Governance**:
   - Delivery partner application and vetting by Admin.
   - Real-time job assignment based on operating PIN codes.
   - Doorstep OTP handoff and rider payout calculation.
   - External courier fallback to Shiprocket for inter-city delivery.

---

## 8. Test Suite & Verification Results

- **Backend Pytest Suite**: **80 tests passing** in 3 minutes 16 seconds (100% pass rate).
  - `test_ai_modules.py`: 15 passed
  - `test_apps_script_email.py`: 10 passed
  - `test_auctions.py`: 2 passed
  - `test_auth.py`: 11 passed
  - `test_delivery_reviews.py`: 2 passed
  - `test_delivery_system.py`: 11 passed
  - `test_email_otp.py`: 13 passed
  - `test_hybrid_local_delivery.py`: 7 passed
  - `test_negotiation.py`: 3 passed
  - `test_orders_payments.py`: 2 passed
  - `test_products.py`: 4 passed
- **Frontend Production Build**: **Zero TypeScript or Vite compilation errors** (`dist/index.html` built in 2.34s).

---

## 9. Production Deployment Configuration

| Tier | Host | Details |
|---|---|---|
| **Frontend** | **Vercel** | SPA hosting with `vercel.json` edge rewrites redirecting `/api/v1/*` and `/api/*` directly to Render backend. |
| **Backend** | **Render** | Web service `revalue-api-qk4m` running Python 3.10 ASGI server. |
| **Database** | **MongoDB Atlas** | Managed replica set with TLS, authenticated connections, and 17 indexed collections. |
| **Email Gateway** | **Google Apps Script** | Web App deployment executing under `revalue26@gmail.com` with `SHARED_SECRET` in `ScriptProperties`. |
