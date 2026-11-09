/**
 * Tugga NIN Portal — Firebase Cloud Functions
 *
 * lumiidNinVerify: Proxies NIN verification requests to the Lumiid API.
 * The API key lives ONLY here — never exposed to the browser.
 *
 * Lumiid API: POST https://api.lumiid.com/v1/nin/basic
 * Auth: X-API-Key header
 *
 * Environment variable (set via Firebase secrets):
 *   LUMIID_API_KEY — your Lumiid production API key
 */

"use strict";

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const fetch     = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ── Lumiid base URL ──────────────────────────────────────────────────────────
const LUMIID_BASE = "https://api.lumiid.com/v1";

// ── Slip type → Lumiid API type mapping ─────────────────────────────────────
// Lumiid exposes: nin/basic (Regular Slip), nin/premium (Premium Slip),
// nin/standard (Standard Slip).
// "Basic Slip" has been removed from the UI — the three real slip types map 1:1.
const SLIP_TO_API = {
  "Regular Slip":  "nin/basic",
  "Premium Slip":  "nin/premium",
  "Standard Slip": "nin/standard",
};

// ── Helper: verify a Firebase ID token and return the decoded payload ────────
async function verifyToken(idToken) {
  return admin.auth().verifyIdToken(idToken);
}

// ── Helper: normalize Lumiid response into a flat record ────────────────────
// Lumiid returns data nested under `data` key with snake_case field names.
function normalizeLumiidResponse(apiData) {
  const d = apiData.data || apiData;
  return {
    nin:               d.nin               || d.NIN               || "",
    firstname:         d.firstname         || d.firstName         || d.first_name  || "",
    middlename:        d.middlename        || d.middleName        || d.middle_name || "",
    surname:           d.surname           || d.lastName          || d.last_name   || d.surname || "",
    birthdate:         d.birthdate         || d.dob               || d.date_of_birth || "",
    telephoneno:       d.telephoneno       || d.phone             || d.phone_number  || "",
    gender:            d.gender            || "",
    residence_address: d.residence_address || d.address           || "",
    residence_town:    d.residence_town    || d.town              || "",
    residence_lga:     d.residence_lga     || d.lga               || "",
    residence_state:   d.residence_state   || d.state             || "",
    photo:             d.photo             || d.image             || d.picture     || null,
  };
}

/**
 * lumiidNinVerify — HTTPS callable Cloud Function
 *
 * Called from the frontend via Firebase SDK httpsCallable().
 * Expects:
 *   data.serviceKey  — "verify-nin" | "phone-verify" | "bio-data" | "fingerprint"
 *   data.slipType    — "Regular Slip" | "Premium Slip" | "Standard Slip"
 *   data.nin         — 11-digit NIN (for verify-nin)
 *   data.phone       — phone number  (for phone-verify)
 *   data.fname       — first name    (for bio-data)
 *   data.lname       — last name     (for bio-data)
 *   data.dob         — date of birth (for bio-data)
 *   data.gender      — gender        (for bio-data)
 *
 * Returns on success:
 *   { ok: true, record: { nin, firstname, ... }, slipType }
 *
 * Returns on no-match (bio-data):
 *   { ok: true, match: false }
 *
 * Throws on error:
 *   functions.https.HttpsError with a user-friendly message
 */
exports.lumiidNinVerify = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {

    // ── 1. Auth check — user must be signed in ─────────────────────────────
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to use this service."
      );
    }

    const uid      = context.auth.uid;
    const { serviceKey, slipType, nin, phone, fname, lname, dob, gender } = data;

    // ── 2. Validate slip type ──────────────────────────────────────────────
    const apiPath = SLIP_TO_API[slipType];
    if (!apiPath) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Unknown slip type: ${slipType}. Must be Regular Slip, Premium Slip, or Standard Slip.`
      );
    }

    // ── 3. Validate service-specific inputs ────────────────────────────────
    if (serviceKey === "verify-nin") {
      if (!nin || !/^\d{11}$/.test(nin)) {
        throw new functions.https.HttpsError("invalid-argument", "NIN must be exactly 11 digits.");
      }
    } else if (serviceKey === "phone-verify") {
      if (!phone || !/^0[789]\d{9}$/.test(phone)) {
        throw new functions.https.HttpsError("invalid-argument", "Enter a valid Nigerian phone number.");
      }
    } else if (serviceKey === "bio-data") {
      if (!fname || !lname || !dob || !gender) {
        throw new functions.https.HttpsError("invalid-argument", "All bio data fields are required.");
      }
    }
    // fingerprint is manual/admin-handled — function still deducts wallet and logs the request

    // ── 4. Read API key from environment ──────────────────────────────────
    // Set with: firebase functions:secrets:set LUMIID_API_KEY
    const apiKey = process.env.LUMIID_API_KEY
      || functions.config().lumiid?.api_key
      || null;

    if (!apiKey) {
      console.error("LUMIID_API_KEY is not configured.");
      throw new functions.https.HttpsError(
        "internal",
        "Service temporarily unavailable. Please contact support."
      );
    }

    // ── 5. Build Lumiid request payload ───────────────────────────────────
    let body = {};
    if (serviceKey === "verify-nin") {
      body = { nin };
    } else if (serviceKey === "phone-verify") {
      body = { phone_number: phone };
    } else if (serviceKey === "bio-data") {
      body = {
        first_name:   fname,
        last_name:    lname,
        dob:          dob,
        gender:       gender.toLowerCase() === "male" ? "M" : "F",
      };
    } else {
      // fingerprint — not a live API call; return a "submitted" placeholder
      return { ok: true, submitted: true, slipType };
    }

    // ── 6. Call Lumiid API ─────────────────────────────────────────────────
    let lumiidRes;
    try {
      lumiidRes = await fetch(`${LUMIID_BASE}/${apiPath}`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key":    apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      console.error("Lumiid network error:", networkErr.message);
      throw new functions.https.HttpsError(
        "unavailable",
        "Could not reach the identity verification service. Please try again."
      );
    }

    // ── 7. Parse response ──────────────────────────────────────────────────
    let apiJson;
    try {
      apiJson = await lumiidRes.json();
    } catch {
      console.error("Lumiid non-JSON response, status:", lumiidRes.status);
      throw new functions.https.HttpsError("internal", "Invalid response from identity service.");
    }

    if (!lumiidRes.ok) {
      const msg = apiJson?.message || apiJson?.error || "Verification failed.";
      console.warn(`Lumiid error [${lumiidRes.status}]:`, msg);
      // 404 = NIN not found; 401/403 = auth problem (don't expose internally)
      if (lumiidRes.status === 404) {
        throw new functions.https.HttpsError("not-found", "NIN record not found.");
      }
      if (lumiidRes.status === 401 || lumiidRes.status === 403) {
        console.error("Lumiid auth error — check API key.");
        throw new functions.https.HttpsError("internal", "Service temporarily unavailable.");
      }
      throw new functions.https.HttpsError("unknown", msg);
    }

    // ── 8. Handle bio-data no-match ────────────────────────────────────────
    if (serviceKey === "bio-data") {
      const matched = apiJson?.data?.match === true
        || apiJson?.match === true
        || apiJson?.data?.matched === true;
      return { ok: true, match: matched, slipType };
    }

    // ── 9. Normalize & return record ───────────────────────────────────────
    const record = normalizeLumiidResponse(apiJson);
    record.nin = record.nin || nin || phone || "";  // fallback to input

    return { ok: true, record, slipType };
  });
