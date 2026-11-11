/**
 * Tugga NIN Portal — Lumiid API Proxy
 *
 * Runs on Render (free tier). The Lumiid API key is stored in
 * Render's environment variables — never in code or git.
 *
 * POST /nin/verify
 *   Body: { serviceKey, slipType, nin?, phone?, fname?, lname?, dob?, gender? }
 *   Returns: { ok, record? } or { ok, match? } or { ok, submitted? }
 */

"use strict";

const express  = require("express");
const fetch    = require("node-fetch");
const cors     = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── API key (set in Render environment variables as LUMIID_API_KEY) ──────────
const LUMIID_API_KEY = process.env.LUMIID_API_KEY;
const LUMIID_BASE    = "https://api.lumiid.com/v1";

// ── CORS — open to all origins (tighten after confirming live) ───────────────
app.use(cors());

app.use(express.json());

// ── Slip → Lumiid API path ────────────────────────────────────────────────────
const SLIP_TO_PATH = {
  "Regular Slip":  "nin/basic",
  "Premium Slip":  "nin/premium",
  "Standard Slip": "nin/standard"
};

// ── Normalize Lumiid response fields ─────────────────────────────────────────
function normalize(apiData) {
  const d = apiData.data || apiData;
  return {
    nin:               d.nin               || d.NIN               || "",
    firstname:         d.firstname         || d.firstName         || d.first_name   || "",
    middlename:        d.middlename        || d.middleName        || d.middle_name  || "",
    surname:           d.surname           || d.lastName          || d.last_name    || "",
    birthdate:         d.birthdate         || d.dob               || d.date_of_birth || "",
    telephoneno:       d.telephoneno       || d.phone             || d.phone_number  || "",
    gender:            d.gender            || "",
    residence_address: d.residence_address || d.address           || "",
    residence_town:    d.residence_town    || d.town              || "",
    residence_lga:     d.residence_lga     || d.lga               || "",
    residence_state:   d.residence_state   || d.state             || "",
    photo:             d.photo             || d.image             || d.picture      || null
  };
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Tugga NIN Proxy" });
});

// ── Main verify endpoint ──────────────────────────────────────────────────────
app.post("/nin/verify", async (req, res) => {

  if (!LUMIID_API_KEY) {
    return res.status(500).json({ ok: false, message: "Service not configured. Contact support." });
  }

  const { serviceKey, slipType, nin, phone, fname, lname, dob, gender } = req.body;

  // Validate slip type
  const apiPath = SLIP_TO_PATH[slipType];
  if (!apiPath) {
    return res.status(400).json({ ok: false, message: "Invalid slip type: " + slipType });
  }

  // Fingerprint — not a live Lumiid API call; flag as submitted for manual processing
  if (serviceKey === "fingerprint") {
    return res.json({ ok: true, submitted: true, slipType });
  }

  // Build Lumiid request body
  let body = {};
  if (serviceKey === "verify-nin") {
    if (!nin || !/^\d{11}$/.test(nin)) {
      return res.status(400).json({ ok: false, message: "NIN must be exactly 11 digits." });
    }
    body = { nin };
  } else if (serviceKey === "phone-verify") {
    if (!phone) {
      return res.status(400).json({ ok: false, message: "Phone number is required." });
    }
    body = { phone_number: phone };
  } else if (serviceKey === "bio-data") {
    if (!fname || !lname || !dob || !gender) {
      return res.status(400).json({ ok: false, message: "All bio data fields are required." });
    }
    body = {
      first_name: fname,
      last_name:  lname,
      dob:        dob,
      gender:     gender.toLowerCase() === "male" ? "M" : "F"
    };
  } else {
    return res.status(400).json({ ok: false, message: "Unknown service key: " + serviceKey });
  }

  // Call Lumiid
  let lumiidRes;
  const lumiidUrl = `${LUMIID_BASE}/${apiPath}`;
  console.log("Calling Lumiid:", lumiidUrl, "serviceKey:", serviceKey);
  try {
    lumiidRes = await fetch(lumiidUrl, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":    LUMIID_API_KEY
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("Lumiid network error:", err.message);
    return res.status(503).json({ ok: false, message: "Could not reach identity service. Please try again." });
  }

  // Parse response
  let apiJson;
  let rawText = '';
  try {
    rawText = await lumiidRes.text();
    apiJson = JSON.parse(rawText);
  } catch {
    console.error("Lumiid non-JSON response, status:", lumiidRes.status, "body:", rawText.slice(0, 500));
    return res.status(502).json({
      ok: false,
      message: "Identity service returned an unexpected response (status " + lumiidRes.status + "). Please check the API endpoint or contact support.",
      debug_status: lumiidRes.status,
      debug_body: rawText.slice(0, 200)
    });
  }

  if (!lumiidRes.ok) {
    const msg = apiJson?.message || apiJson?.error || "Verification failed.";
    console.warn(`Lumiid error [${lumiidRes.status}]:`, JSON.stringify(apiJson).slice(0, 300));
    if (lumiidRes.status === 404) {
      return res.status(404).json({ ok: false, message: "NIN record not found." });
    }
    if (lumiidRes.status === 401 || lumiidRes.status === 403) {
      console.error("Lumiid auth error — check API key configuration.");
      return res.status(500).json({ ok: false, message: "Service temporarily unavailable." });
    }
    return res.status(lumiidRes.status).json({ ok: false, message: msg });
  }

  // Bio-data match check
  if (serviceKey === "bio-data") {
    const matched = apiJson?.data?.match === true
      || apiJson?.match === true
      || apiJson?.data?.matched === true;
    return res.json({ ok: true, match: matched, slipType });
  }

  // Return normalized record
  const record = normalize(apiJson);
  record.nin = record.nin || nin || phone || "";
  console.log("Lumiid success, raw keys:", Object.keys(apiJson?.data || apiJson).join(", "));
  return res.json({ ok: true, record, slipType });
});

app.listen(PORT, () => {
  console.log(`Tugga NIN Proxy running on port ${PORT}`);
});
