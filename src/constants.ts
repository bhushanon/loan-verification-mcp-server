// ─── API Endpoints (swap these for real provider URLs) ────────────────────────
export const API_ENDPOINTS = {
  // NSDL / Income Tax PAN verification
  PAN_VERIFY: process.env.PAN_VERIFY_URL || "https://mock.api.local/pan/verify",

  // UIDAI Aadhaar OTP / face match  
  AADHAAR_VERIFY: process.env.AADHAAR_VERIFY_URL || "https://mock.api.local/aadhaar/verify",
  AADHAAR_FACE_MATCH: process.env.AADHAAR_FACE_URL || "https://mock.api.local/aadhaar/face-match",
  

  // GST portal API
  GST_VERIFY: process.env.GST_VERIFY_URL || "https://mock.api.local/gst/verify",
  GST_RETURNS: process.env.GST_RETURNS_URL || "https://mock.api.local/gst/returns",

  // Dental Council of India registry
  DENTAL_COUNCIL: process.env.DENTAL_COUNCIL_URL || "https://mock.api.local/dental-council/verify",

  // Internal fraud registry (your bank's system)
  FRAUD_REGISTRY: process.env.FRAUD_REGISTRY_URL || "https://mock.api.local/fraud/query",
  FRAUD_SIGNAL_SUBMIT: process.env.FRAUD_SIGNAL_URL || "https://mock.api.local/fraud/signal",

  // OCR / Document intelligence (e.g. AWS Textract, Azure DI)
  OCR_PARSE: process.env.OCR_URL || "https://mock.api.local/ocr/parse",

  // Internal LOS / core banking for dedup
  INTERNAL_DEDUP: process.env.DEDUP_URL || "https://mock.api.local/internal/dedup",
};

// ─── Auth Keys (set via environment variables) ────────────────────────────────
export const API_KEYS = {
  PAN_API_KEY: process.env.PAN_API_KEY || "MOCK_KEY",
  GST_API_KEY: process.env.GST_API_KEY || "MOCK_KEY",
  AADHAAR_API_KEY: process.env.AADHAAR_API_KEY || "MOCK_KEY",
  FRAUD_API_KEY: process.env.FRAUD_API_KEY || "MOCK_KEY",
  OCR_API_KEY: process.env.OCR_API_KEY || "MOCK_KEY",
  DENTAL_API_KEY: process.env.DENTAL_API_KEY || "MOCK_KEY",
};

// ─── Thresholds ────────────────────────────────────────────────────────────────
export const THRESHOLDS = {
  MIN_CONFIDENCE_SCORE: 70,       // OCR confidence below this triggers manual review
  MIN_NAME_MATCH_SCORE: 75,       // Name fuzzy match threshold
  MIN_FACE_MATCH_SCORE: 80,       // Face match threshold for video KYC
  MAX_SHELL_ENTITY_SCORE: 40,     // GST shell risk above this = block
  MAX_FRAUD_RISK_SCORE: 60,       // Fraud score above this = block
  MAX_GST_MONTHS_UNFILED: 3,      // Months without GST filing = flag
  MIN_PRACTICE_YEARS: 0,          // Minimum dental practice vintage
};

// ─── Response Limits ──────────────────────────────────────────────────────────
export const CHARACTER_LIMIT = 50000;
export const USE_MOCK_APIS = process.env.USE_MOCK_APIS !== "false"; // default true for dev
