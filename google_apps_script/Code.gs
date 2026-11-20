/**
 * ReValue Marketplace — Google Apps Script Email Gateway
 * 
 * Secure HTTPS email dispatch gateway for ReValue running on Google Apps Script.
 * Allows the ReValue backend on Render (or other cloud platforms) to send
 * transactional verification codes via Google MailApp over HTTPS (Port 443).
 *
 * Sender Account: revalue26@gmail.com
 * Display Name:   ReValue Marketplace
 * Supported Actions:
 *   - 'ping' / 'health': Connectivity health check without email dispatch
 *   - 'send_otp': Registration/authentication email verification code (5-min expiry)
 *   - 'send_delivery_otp': Order-specific buyer doorstep delivery verification code (48-hr expiry)
 */

// Configuration constants
var CONFIG = {
  SENDER_NAME: "ReValue Marketplace",
  MAX_PAYLOAD_BYTES: 65536, // 64 KB max payload to prevent resource exhaustion
  MAX_EMAIL_LENGTH: 254,
  MAX_NAME_LENGTH: 100,
  MAX_ORDER_ID_LENGTH: 64,
  MAX_PRODUCT_TITLE_LENGTH: 120,
  MAX_CARRIER_LENGTH: 64,
  DEFAULT_EXPIRY_MINUTES: 5,
  DEFAULT_DELIVERY_EXPIRY_HOURS: 48,
  EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
  OTP_REGEX: /^\d{6}$/,
  ORDER_ID_REGEX: /^[a-zA-Z0-9_\-#]+$/
};

/**
 * Handles HTTP POST requests from the ReValue backend.
 *
 * @param {Object} e - Event object containing postData.
 * @return {TextOutput} JSON response with MIME type application/json.
 */
function doPost(e) {
  try {
    // 1. Guard against missing or oversized payload
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        error: { code: "BAD_REQUEST", message: "Request body is empty or missing postData." }
      });
    }

    if (e.postData.contents.length > CONFIG.MAX_PAYLOAD_BYTES) {
      return jsonResponse({
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds maximum allowed size." }
      });
    }

    // 2. Parse JSON payload safely
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({
        success: false,
        error: { code: "INVALID_JSON", message: "Malformed JSON payload." }
      });
    }

    if (!payload || typeof payload !== "object") {
      return jsonResponse({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Payload must be a JSON object." }
      });
    }

    // 3. Authenticate shared secret against Script Properties
    var scriptProperties = PropertiesService.getScriptProperties();
    var expectedSecret = scriptProperties.getProperty("APPS_SCRIPT_SHARED_SECRET") || 
                         scriptProperties.getProperty("SHARED_SECRET");

    if (!expectedSecret || expectedSecret.trim().length === 0) {
      return jsonResponse({
        success: false,
        error: {
          code: "SERVER_MISCONFIGURED",
          message: "Gateway shared secret is not configured in Google Apps Script Script Properties."
        }
      });
    }

    var providedSecret = payload.shared_secret || payload.secret || "";
    if (!constantTimeCompare(providedSecret, expectedSecret)) {
      return jsonResponse({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or missing shared secret." }
      });
    }

    // 4. Route action
    var action = (payload.action || "send_otp").toLowerCase().trim();

    // 4a. Health / Ping check action (does not send an email)
    if (action === "ping" || action === "health") {
      return jsonResponse({
        success: true,
        message: "ReValue Google Apps Script Email Gateway is operational.",
        timestamp: new Date().toISOString()
      });
    }

    // 4b. Send registration OTP action (Preserved 100% backward-compatible)
    if (action === "send_otp") {
      return handleSendOtp(payload);
    }

    // 4c. Send delivery verification OTP action (New Phase A action)
    if (action === "send_delivery_otp") {
      return handleSendDeliveryOtp(payload);
    }

    // 4d. Unknown action
    return jsonResponse({
      success: false,
      error: {
        code: "UNKNOWN_ACTION",
        message: "Unsupported action '" + action + "'. Supported actions: 'ping', 'send_otp', 'send_delivery_otp'."
      }
    });

  } catch (unexpectedErr) {
    return jsonResponse({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred while processing the request."
      }
    });
  }
}

/**
 * Handles HTTP GET requests for browser health check and service discovery.
 */
function doGet(e) {
  return jsonResponse({
    service: "ReValue Google Apps Script Email Gateway",
    status: "active",
    sender: Session.getActiveUser().getEmail() || "revalue26@gmail.com",
    supported_actions: ["ping", "send_otp", "send_delivery_otp"],
    usage: "POST with JSON payload containing 'action' and authorized 'shared_secret'."
  });
}

/**
 * Validates parameters and sends the branded ReValue registration OTP verification email.
 * Preserved 100% for existing user registration and authentication workflows.
 */
function handleSendOtp(payload) {
  var rawEmail = payload.email;
  var rawOtp = payload.otp;
  var rawName = payload.name;
  var expiresInMinutes = parseInt(payload.expires_in_minutes, 10) || CONFIG.DEFAULT_EXPIRY_MINUTES;

  // Validate recipient email
  if (typeof rawEmail !== "string" || !rawEmail.trim() || rawEmail.length > CONFIG.MAX_EMAIL_LENGTH) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_EMAIL", message: "Missing or invalid recipient email." }
    });
  }
  var email = rawEmail.trim().toLowerCase();
  if (!CONFIG.EMAIL_REGEX.test(email)) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_EMAIL", message: "Recipient email address does not match standard RFC format." }
    });
  }

  // Validate 6-digit OTP
  if (typeof rawOtp !== "string" && typeof rawOtp !== "number") {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_OTP", message: "Missing OTP code." }
    });
  }
  var otp = String(rawOtp).trim();
  if (!CONFIG.OTP_REGEX.test(otp)) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_OTP", message: "OTP must be exactly 6 numeric digits." }
    });
  }

  // Sanitize user display name
  var displayName = "ReValue User";
  if (typeof rawName === "string" && rawName.trim().length > 0) {
    displayName = sanitizeHtml(rawName.trim().slice(0, CONFIG.MAX_NAME_LENGTH));
  }

  // Construct email subject and content
  var subject = otp + " is your ReValue verification code";

  var textBody = [
    "Hello " + displayName + ",",
    "",
    "Thank you for registering on ReValue!",
    "",
    "Your one-time verification code is:",
    "    " + otp,
    "",
    "This code is valid for " + expiresInMinutes + " minutes. Never share this code with anyone.",
    "",
    "If you did not attempt to register on ReValue, please ignore this email.",
    "",
    "Best regards,",
    "The ReValue Team",
    "https://revalue.market"
  ].join("\n");

  var htmlBody = buildHtmlEmail(displayName, otp, expiresInMinutes);

  // Dispatch email via MailApp
  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody,
      name: CONFIG.SENDER_NAME
    });

    return jsonResponse({
      success: true,
      message: "Verification email dispatched successfully.",
      timestamp: new Date().toISOString()
    });
  } catch (mailErr) {
    var errorMsg = (mailErr && mailErr.message) ? String(mailErr.message) : "MailApp dispatch error.";
    // Never leak OTP or secrets in error messages
    errorMsg = errorMsg.replace(new RegExp(otp, "g"), "******");
    return jsonResponse({
      success: false,
      error: {
        code: "DELIVERY_FAILED",
        message: "Google MailApp failed to dispatch email: " + errorMsg
      }
    });
  }
}

/**
 * Validates parameters and sends the branded ReValue Buyer Doorstep Delivery OTP verification email.
 * Dedicated action for order delivery custody verification.
 */
function handleSendDeliveryOtp(payload) {
  var rawEmail = payload.email;
  var rawOtp = payload.otp;
  var rawName = payload.name;
  var rawOrderId = payload.order_id || payload.orderId;
  var rawProductTitle = payload.product_title || payload.item_title;
  var rawCarrierName = payload.carrier_name || payload.partner_name;
  var rawExpiresHours = parseInt(payload.expires_in_hours, 10);
  var expiresInHours = (!isNaN(rawExpiresHours) && rawExpiresHours >= 1 && rawExpiresHours <= 168)
    ? rawExpiresHours
    : CONFIG.DEFAULT_DELIVERY_EXPIRY_HOURS;

  // 1. Validate recipient email
  if (typeof rawEmail !== "string" || !rawEmail.trim() || rawEmail.length > CONFIG.MAX_EMAIL_LENGTH) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_EMAIL", message: "Missing or invalid recipient email." }
    });
  }
  var email = rawEmail.trim().toLowerCase();
  if (!CONFIG.EMAIL_REGEX.test(email)) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_EMAIL", message: "Recipient email address does not match standard RFC format." }
    });
  }

  // 2. Validate 6-digit numeric OTP
  if (typeof rawOtp !== "string" && typeof rawOtp !== "number") {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_OTP", message: "Missing OTP code." }
    });
  }
  var otp = String(rawOtp).trim();
  if (!CONFIG.OTP_REGEX.test(otp)) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_OTP", message: "OTP must be exactly 6 numeric digits." }
    });
  }

  // 3. Validate order reference ID
  if (typeof rawOrderId !== "string" || !rawOrderId.trim()) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_ORDER_ID", message: "Missing or empty order_id." }
    });
  }
  var orderId = sanitizeHtml(rawOrderId.trim().slice(0, CONFIG.MAX_ORDER_ID_LENGTH));
  if (!CONFIG.ORDER_ID_REGEX.test(orderId)) {
    return jsonResponse({
      success: false,
      error: { code: "INVALID_ORDER_ID", message: "order_id contains unsupported characters." }
    });
  }

  // 4. Sanitize optional descriptive metadata
  var displayName = "ReValue Customer";
  if (typeof rawName === "string" && rawName.trim().length > 0) {
    displayName = sanitizeHtml(rawName.trim().slice(0, CONFIG.MAX_NAME_LENGTH));
  }

  var productTitle = "Verified Smartphone";
  if (typeof rawProductTitle === "string" && rawProductTitle.trim().length > 0) {
    productTitle = sanitizeHtml(rawProductTitle.trim().slice(0, CONFIG.MAX_PRODUCT_TITLE_LENGTH));
  }

  var carrierName = "ReValue Verified Delivery Partner";
  if (typeof rawCarrierName === "string" && rawCarrierName.trim().length > 0) {
    carrierName = sanitizeHtml(rawCarrierName.trim().slice(0, CONFIG.MAX_CARRIER_LENGTH));
  }

  // 5. Construct email subject and content
  var subject = "📦 " + otp + " is your ReValue delivery code for order " + orderId;

  var textBody = [
    "Hello " + displayName + ",",
    "",
    "Great news! Your ReValue order " + orderId + " for " + productTitle + " is in transit.",
    "",
    "Your 6-digit doorstep delivery verification code is:",
    "    " + otp,
    "",
    "Delivery Partner: " + carrierName,
    "Code Validity:    " + expiresInHours + " hours",
    "",
    "CRITICAL DOORSTEP INSTRUCTIONS:",
    "1. Inspect the exterior box and tamper-evident security seal upon arrival.",
    "2. Provide this 6-digit code to your delivery partner ONLY after you have received the package in person.",
    "3. Never share this code over the phone, SMS, or WhatsApp before the physical package is delivered.",
    "4. Once verified by your delivery partner, your mandatory 48-Hour Buyer Inspection Period begins immediately.",
    "",
    "If you have questions or suspect fraudulent activity, please contact support@revalue.market immediately.",
    "",
    "Best regards,",
    "The ReValue Delivery Team",
    "https://revalue.market"
  ].join("\n");

  var htmlBody = buildDeliveryHtmlEmail(displayName, otp, orderId, productTitle, carrierName, expiresInHours);

  // 6. Dispatch email via MailApp
  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody,
      name: CONFIG.SENDER_NAME
    });

    return jsonResponse({
      success: true,
      message: "Delivery verification email dispatched successfully.",
      order_id: orderId,
      timestamp: new Date().toISOString()
    });
  } catch (mailErr) {
    var errorMsg = (mailErr && mailErr.message) ? String(mailErr.message) : "MailApp dispatch error.";
    // Never leak OTP or secrets in error messages
    errorMsg = errorMsg.replace(new RegExp(otp, "g"), "******");
    return jsonResponse({
      success: false,
      error: {
        code: "DELIVERY_FAILED",
        message: "Google MailApp failed to dispatch email: " + errorMsg
      }
    });
  }
}

/**
 * Builds responsive, branded HTML email for ReValue account registration verification.
 */
function buildHtmlEmail(displayName, otp, expiresInMinutes) {
  return '<!DOCTYPE html>' +
  '<html lang="en">' +
  '<head>' +
  '  <meta charset="UTF-8">' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '  <title>ReValue Verification Code</title>' +
  '  <style>' +
  '    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }' +
  '    .email-container { max-width: 520px; margin: 32px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }' +
  '    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; border-bottom: 3px solid #059669; }' +
  '    .brand-title { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }' +
  '    .brand-accent { color: #10b981; }' +
  '    .brand-tagline { margin: 6px 0 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; }' +
  '    .content { padding: 32px 28px; }' +
  '    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px 0; }' +
  '    .lead-text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }' +
  '    .otp-box { background: #f0fdf4; border: 2px dashed #059669; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0; }' +
  '    .otp-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #047857; margin: 0 0 8px 0; }' +
  '    .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46; font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, monospace; margin: 0; padding-left: 8px; }' +
  '    .otp-meta { margin: 10px 0 0 0; font-size: 12px; color: #047857; font-weight: 500; }' +
  '    .notice-card { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 14px; margin: 0 0 24px 0; }' +
  '    .notice-text { margin: 0; font-size: 12px; line-height: 1.5; color: #92400e; }' +
  '    .footer { background: #f8fafc; padding: 20px 24px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }' +
  '  </style>' +
  '</head>' +
  '<body>' +
  '  <div class="email-container">' +
  '    <div class="header">' +
  '      <h1 class="brand-title">Re<span class="brand-accent">Value</span></h1>' +
  '      <p class="brand-tagline">Pre-Owned Smartphone Marketplace</p>' +
  '    </div>' +
  '    <div class="content">' +
  '      <p class="greeting">Hello ' + displayName + ',</p>' +
  '      <p class="lead-text">' +
  '        Thank you for choosing ReValue. To verify your email address and activate your account, please enter the verification code below:' +
  '      </p>' +
  '      <div class="otp-box">' +
  '        <div class="otp-label">Verification Code (OTP)</div>' +
  '        <div class="otp-code">' + otp + '</div>' +
  '        <p class="otp-meta">&#9201; Expires in ' + expiresInMinutes + ' minutes</p>' +
  '      </div>' +
  '      <div class="notice-card">' +
  '        <p class="notice-text">' +
  '          <strong>Security Notice:</strong> ReValue representatives will never ask for your verification code. Never share this code with anyone. If you did not create an account on ReValue, you can safely ignore this email.' +
  '        </p>' +
  '      </div>' +
  '    </div>' +
  '    <div class="footer">' +
  '      <p style="margin: 0 0 6px 0;">&copy; ' + CONFIG.SENDER_NAME + ' &bull; All rights reserved.</p>' +
  '      <p style="margin: 0;">Automated message sent by ReValue. Please do not reply directly to this email.</p>' +
  '    </div>' +
  '  </div>' +
  '</body>' +
  '</html>';
}

/**
 * Builds responsive, branded HTML email for ReValue Buyer Doorstep Delivery OTP verification.
 */
function buildDeliveryHtmlEmail(displayName, otp, orderId, productTitle, carrierName, expiresInHours) {
  return '<!DOCTYPE html>' +
  '<html lang="en">' +
  '<head>' +
  '  <meta charset="UTF-8">' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '  <title>ReValue Delivery Verification Code</title>' +
  '  <style>' +
  '    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }' +
  '    .email-container { max-width: 540px; margin: 32px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }' +
  '    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; border-bottom: 3px solid #059669; }' +
  '    .brand-title { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }' +
  '    .brand-accent { color: #10b981; }' +
  '    .brand-tagline { margin: 6px 0 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; }' +
  '    .content { padding: 32px 28px; }' +
  '    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px 0; }' +
  '    .lead-text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }' +
  '    .order-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 0 0 24px 0; }' +
  '    .order-row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }' +
  '    .order-label { color: #64748b; font-weight: 500; }' +
  '    .order-val { color: #0f172a; font-weight: 700; }' +
  '    .otp-box { background: #f0fdf4; border: 2px dashed #059669; border-radius: 10px; padding: 22px; text-align: center; margin: 0 0 24px 0; }' +
  '    .otp-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #047857; margin: 0 0 8px 0; }' +
  '    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #065f46; font-family: "SF Mono", Consolas, "Liberation Mono", Menlo, monospace; margin: 0; padding-left: 10px; }' +
  '    .otp-meta { margin: 10px 0 0 0; font-size: 12px; color: #047857; font-weight: 500; }' +
  '    .notice-card { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 14px; margin: 0 0 16px 0; }' +
  '    .notice-title { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #b45309; }' +
  '    .notice-text { margin: 0; font-size: 12px; line-height: 1.5; color: #92400e; }' +
  '    .protection-card { background: #eff6ff; border: 1px solid #dbeafe; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 14px; margin: 0 0 24px 0; }' +
  '    .protection-title { margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #1d4ed8; }' +
  '    .protection-text { margin: 0; font-size: 12px; line-height: 1.5; color: #1e40af; }' +
  '    .footer { background: #f8fafc; padding: 20px 24px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; }' +
  '  </style>' +
  '</head>' +
  '<body>' +
  '  <div class="email-container">' +
  '    <div class="header">' +
  '      <h1 class="brand-title">Re<span class="brand-accent">Value</span></h1>' +
  '      <p class="brand-tagline">Secure Doorstep Delivery Verification</p>' +
  '    </div>' +
  '    <div class="content">' +
  '      <p class="greeting">Hello ' + displayName + ',</p>' +
  '      <p class="lead-text">' +
  '        Your smartphone order is in transit! When your delivery partner arrives at your address, please inspect the package and provide the 6-digit verification code below to complete the physical handover:' +
  '      </p>' +
  '      <div class="order-card">' +
  '        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">' +
  '          <tr><td style="color: #64748b; padding: 3px 0;">Order Reference:</td><td style="text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">' + orderId + '</td></tr>' +
  '          <tr><td style="color: #64748b; padding: 3px 0;">Smartphone:</td><td style="text-align: right; font-weight: 700; color: #0f172a;">' + productTitle + '</td></tr>' +
  '          <tr><td style="color: #64748b; padding: 3px 0;">Delivery Partner:</td><td style="text-align: right; font-weight: 600; color: #059669;">' + carrierName + '</td></tr>' +
  '        </table>' +
  '      </div>' +
  '      <div class="otp-box">' +
  '        <div class="otp-label">Doorstep Delivery Code</div>' +
  '        <div class="otp-code">' + otp + '</div>' +
  '        <p class="otp-meta">&#9201; Valid for your delivery window (' + expiresInHours + ' hours)</p>' +
  '      </div>' +
  '      <div class="notice-card">' +
  '        <p class="notice-title">&#128274; Security Advisory</p>' +
  '        <p class="notice-text">' +
  '          Provide this code to your delivery partner <strong>only in person</strong> after inspecting the exterior packaging. Never share this code over the phone, chat, or WhatsApp before the physical package is in your hands.' +
  '        </p>' +
  '      </div>' +
  '      <div class="protection-card">' +
  '        <p class="protection-title">&#9989; 48-Hour Buyer Protection Active</p>' +
  '        <p class="protection-text">' +
  '          Once this code is verified, your payment remains held securely in ReValue escrow. Your <strong>48-Hour Inspection Period</strong> starts immediately, allowing you to test all hardware functions.' +
  '        </p>' +
  '      </div>' +
  '    </div>' +
  '    <div class="footer">' +
  '      <p style="margin: 0 0 6px 0;">&copy; ' + CONFIG.SENDER_NAME + ' &bull; All rights reserved.</p>' +
  '      <p style="margin: 0;">Automated delivery dispatch notice from ReValue. Please do not reply directly to this email.</p>' +
  '    </div>' +
  '  </div>' +
  '</body>' +
  '</html>';
}

/**
 * Constant-time string comparison to defend against timing attacks.
 */
function constantTimeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Escapes HTML characters in user-provided strings.
 */
function sanitizeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Returns a JSON TextOutput response.
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
