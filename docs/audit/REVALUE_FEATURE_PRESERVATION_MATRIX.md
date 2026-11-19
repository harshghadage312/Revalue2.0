# ReValue — Feature Preservation Matrix

**Document Purpose**: Define the strict non-negotiable preservation boundaries for the ReValue capstone project before any external master prompt instructions are considered.

Every feature listed in this matrix is currently **functional, tested, and integrated**. No modification, deletion, refactoring, or architectural replacement is permitted without explicit prior approval.

---

## 1. Machine Learning & Artificial Intelligence Subsystems

| Feature / Capability | Source Code Files | Model Artifacts | Status | Protection Level | Regression Risk if Touched |
|---|---|---|---|---|---|
| **MobileNetV2 Condition Classification** | [`ml/mobile_condition/predict.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/predict.py)<br/>[`ml/mobile_condition/preprocess.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/mobile_condition/preprocess.py)<br/>[`backend/app/api/v1/ml.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/api/v1/ml.py#L75-L100) | `ml/mobile_condition/artifacts/mobilenet_condition.keras`<br/>`ml/mobile_condition/artifacts/mobilenet_condition.h5`<br/>`condition_metadata.json` | **LIVE & TESTED** | **ZERO-TOUCH / MANDATORY PRESERVE** | **Project Failure Risk**: Replacing with rules or mock outputs destroys the academic integrity of the capstone project and invalidates external viva evaluation. |
| **MindValue Random Forest Price Regressor** | [`ml/price_prediction/predict.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/predict.py)<br/>[`ml/price_prediction/features.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/features.py)<br/>[`backend/app/api/v1/ml.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/api/v1/ml.py#L30-L74) | `ml/price_prediction/artifacts/mindvalue_random_forest_model.pkl`<br/>`ml/price_prediction/artifacts/rf_price_model.joblib`<br/>`model_metadata.json` | **LIVE & TESTED** | **ZERO-TOUCH / MANDATORY PRESERVE** | **Project Failure Risk**: ReValue’s valuation engine depends on 17 specific feature encodings and 754 known models. Overwriting breaks price valuations across marketplace and seller listings. |
| **Interactive AI Condition Scanner UI** | [`frontend/src/components/AiConditionModal.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/components/AiConditionModal.tsx) | N/A | **LIVE & FUNCTIONAL** | **MANDATORY PRESERVE** | Breaks seller multi-angle camera inspection and condition confidence score visualization. |
| **Interactive AI Price Valuator UI** | [`frontend/src/components/AiPriceValuatorModal.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/components/AiPriceValuatorModal.tsx) | N/A | **LIVE & FUNCTIONAL** | **MANDATORY PRESERVE** | Breaks real-time price estimation slider and recommendation cards in listing creation. |
| **Smart Smartphone Catalogue Service** | [`ml/price_prediction/catalogue.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/price_prediction/catalogue.py) | Internal curated dictionary (26 brands, 754 models) | **LIVE & TESTED** | **MANDATORY PRESERVE** | Breaks auto-fill of technical specifications during product creation. |
| **Personalized Recommendations** | [`ml/recommendations/recommender.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/ml/recommendations/recommender.py) | N/A | **LIVE & TESTED** | **MANDATORY PRESERVE** | Breaks homepage and marketplace product recommendation feeds. |

---

## 2. Authentication, Security & Email Gateway Subsystems

| Feature / Capability | Source Code Files | External Services | Status | Protection Level | Regression Risk if Touched |
|---|---|---|---|---|---|
| **Google Apps Script HTTPS Email Gateway** | [`backend/app/services/email_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/email_service.py#L140-L245)<br/>[`google_apps_script/Code.gs`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/google_apps_script/Code.gs) | Google Apps Script Web App (`revalue26@gmail.com`) via HTTPS Port 443 | **VERIFIED & OPERATIONAL** | **ZERO-TOUCH / MANDATORY PRESERVE** | **Immediate Outage**: Direct SMTP (Brevo or Gmail SMTP) fails on Render Free tier due to blocked ports 25, 465, and 587. Google Apps Script is the only proven working transport. |
| **Two-Step Registration OTP Flow** | [`frontend/src/components/auth/AuthModal.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/components/auth/AuthModal.tsx)<br/>[`backend/app/api/v1/auth.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/api/v1/auth.py#L21-L30) | MongoDB `email_verifications` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Breaks user registration on live production site. |
| **HMAC-SHA256 Zero-Plaintext Security** | [`backend/app/services/auth_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/auth_service.py#L25-L140) | MongoDB Atlas | **LIVE & TESTED** | **MANDATORY PRESERVE** | Compromises user privacy and security requirements. |
| **JWT Authentication & Rotation** | [`backend/app/core/security.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/core/security.py)<br/>[`frontend/src/context/AuthContext.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/context/AuthContext.tsx) | MongoDB `refresh_tokens` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Causes immediate logout loops and invalidates existing admin, seller, buyer, and rider sessions. |

---

## 3. Marketplace, Negotiation & Auction Subsystems

| Feature / Capability | Source Code Files | Database Collections | Status | Protection Level | Regression Risk if Touched |
|---|---|---|---|---|---|
| **Product Listings & Verification** | [`backend/app/services/product_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/product_service.py)<br/>[`frontend/src/pages/CreateListingPage.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/CreateListingPage.tsx) | MongoDB `products` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Destroys active smartphone marketplace inventory. |
| **Open Negotiation & Counteroffers** | [`backend/app/services/offer_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/offer_service.py)<br/>[`backend/app/services/negotiation.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/negotiation.py) | MongoDB `offers` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Removes one of the two core novel commercial mechanisms required for the academic thesis. |
| **Sealed Bidding Auctions** | [`backend/app/services/auction_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/auction_service.py)<br/>[`backend/app/api/v1/auctions.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/api/v1/auctions.py) | MongoDB `auctions`, `bids` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Removes second commercial mechanism. Bids are cryptographically sealed until deadline; must not be removed. |
| **Escrow & Buyer Protection** | [`backend/app/services/order_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/order_service.py)<br/>[`frontend/src/pages/CheckoutPage.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/CheckoutPage.tsx) | MongoDB `orders`, `payments` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Leaves payments unsecured, removes 48-hour inspection protection. |
| **User Dashboards (Buyer & Seller)** | [`frontend/src/pages/BuyerDashboard.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/BuyerDashboard.tsx)<br/>[`frontend/src/pages/SellerDashboard.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/SellerDashboard.tsx) | MongoDB `orders`, `products`, `offers` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Breaks user experience and order management. |

---

## 4. Hyperlocal Delivery & Rider Governance Subsystems

| Feature / Capability | Source Code Files | Database Collections | Status | Protection Level | Regression Risk if Touched |
|---|---|---|---|---|---|
| **Delivery Partner (Rider) Dashboard** | [`frontend/src/pages/RiderDashboard.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/RiderDashboard.tsx)<br/>[`frontend/src/pages/RiderJobsPage.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/RiderJobsPage.tsx)<br/>[`frontend/src/pages/RiderEarningsPage.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/RiderEarningsPage.tsx) | MongoDB `rider_profiles`, `delivery_jobs` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Riders cannot accept delivery jobs, view routes, or claim compensation payouts. |
| **Rider Registration & Application Review** | [`frontend/src/pages/DeliveryPartnerSignupPage.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/DeliveryPartnerSignupPage.tsx)<br/>[`backend/app/services/rider_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/rider_service.py) | MongoDB `rider_profiles` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Breaks driver onboarding and verification pipeline. |
| **Admin Fleet Governance Console** | [`frontend/src/pages/AdminDashboard.tsx`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/frontend/src/pages/AdminDashboard.tsx)<br/>[`backend/app/services/admin_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/admin_service.py) | MongoDB `rider_profiles`, `service_areas`, `delivery_jobs` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Admin cannot approve/reject rider applications, configure PIN codes, or reconcile COD payouts. |
| **Hyperlocal Routing & Doorstep OTP** | [`backend/app/services/hybrid_routing_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/hybrid_routing_service.py)<br/>[`backend/app/services/delivery_service.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/services/delivery_service.py) | MongoDB `delivery_jobs` | **LIVE & TESTED** | **MANDATORY PRESERVE** | Disables PIN-code dispatch routing and doorstep fraud prevention. |
| **Shiprocket External Courier Fallback** | [`backend/app/integrations/courier/shiprocket_adapter.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/integrations/courier/shiprocket_adapter.py) | External Shiprocket API | **CONFIGURED & TESTED** | **MANDATORY PRESERVE** | Breaks inter-city parcel shipping fallback when local riders are out of range. |

---

## 5. Persistence & Database Subsystems

| Feature / Capability | Source Code Files | Target System | Status | Protection Level | Regression Risk if Touched |
|---|---|---|---|---|---|
| **MongoDB Atlas Live Connection** | [`backend/app/db/connection.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/db/connection.py) | MongoDB Atlas `revalue_db` | **LIVE IN PRODUCTION** | **ZERO-TOUCH / MANDATORY PRESERVE** | **Total System Destruction**: Any migration to PostgreSQL destroys all 17 collections, drops user accounts, wipes listings, and invalidates all 116 APIs. |
| **In-Memory Testing Database** | [`backend/app/db/connection.py`](file:///C:/Users/Harshad/.gemini/antigravity/scratch/revalue/backend/app/db/connection.py#L47-L380) | Local RAM (Pytest) | **LIVE & TESTED** | **MANDATORY PRESERVE** | Breaks all 80 automated unit and integration tests if removed. |
