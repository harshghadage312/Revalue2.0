/**
 * ReValue Marketplace — Google Apps Script Email Gateway
 * 
 * Secure HTTPS email dispatch gateway for ReValue running on Google Apps Script.
 * Allows the ReValue backend on Render (or other cloud platforms) to send
 * registration verification codes via Google MailApp over HTTPS (Port 443).
 *
 * Sender Account: revalue26@gmail.com
 * Display Name:   ReValue Marketplace
 */

// Configuration constants
var CONFIG = {
  SENDER_NAME: "ReValue Marketplace",
  MAX_PAYLOAD_BYTES: 65536, // 64 KB max payload to prevent resource exhaustion
  MAX_EMAIL_LENGTH: 254,
  MAX_NAME_LENGTH: 100,
  DEFAULT_EXPIRY_MINUTES: 5,
  EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
  OTP_REGEX: /^\d{6}$/
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

    // 4b. Send OTP action
    if (action === "send_otp") {
      return handleSendOtp(payload);
    }

    // 4c. Unknown action
    return jsonResponse({
      success: false,
      error: {
        code: "UNKNOWN_ACTION",
        message: "Unsupported action '" + action + "'. Supported actions: 'ping', 'send_otp'."
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
    usage: "POST with JSON payload containing 'action' and authorized 'shared_secret'."
  });
}

/**
 * Validates parameters and sends the branded ReValue OTP verification email.
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
    errorMsg = errorMsg.replace(otp, "******");
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
 * Builds responsive, branded HTML email for ReValue.
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
 * Escapes HTML characters in user-provided names.
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
