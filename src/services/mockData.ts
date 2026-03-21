import { now } from "./apiClient.js";

// ─── Mock API responses keyed by mock key ─────────────────────────────────────
// These simulate realistic responses. Replace with real API calls via USE_MOCK_APIS=false

export const mockResponses: Record<string, unknown> = {
  "pan_verify_ABCDE1234F__": {
    pan: "ABCDE1234F",
    valid_format: true,
    name_on_pan: "RAJESH KUMAR SHARMA",
    pan_type: "individual",
    dedup_status: "clean",
    watchlist_flags: [],
    validated_at: now(),
  },
  
  // ── PAN Verification ─────────────────────────────────────────────────────
  "pan_verify_ABCDE1234F": {
    pan: "ABCDE1234F",
    valid_format: true,
    name_on_pan: "RAJESH KUMAR SHARMA",
    pan_type: "individual",
    dedup_status: "clean",
    watchlist_flags: [],
    validated_at: now(),
  },
  "pan_verify_ZZZZZ9999Z": {
    pan: "ZZZZZ9999Z",
    valid_format: true,
    name_on_pan: "SOME FLAGGED PERSON",
    pan_type: "individual",
    dedup_status: "watchlist_hit",
    watchlist_flags: ["PMLA_WATCHLIST", "COURT_ORDER"],
    validated_at: now(),
  },

  // ── Aadhaar Verification ─────────────────────────────────────────────────
  "aadhaar_verify_9876": {
    aadhaar_last4: "9876",
    name_match: true,
    name_match_score: 94,
    address_consistency: true,
    address_risk_signals: [],
    face_match_score: null,
    verification_status: "verified",
    verified_at: now(),
  },

  // ── GST Verification ─────────────────────────────────────────────────────
  "gst_verify_29ABCDE1234F1Z5": {
    gstin: "29ABCDE1234F1Z5",
    legal_name: "SHARMA DENTAL CLINIC LLP",
    trade_name: "Dr. Sharma Dental",
    registration_date: "2021-06-15",
    status: "active",
    business_type: "LLP",
    principal_address: "42 MG Road, Bangalore, Karnataka 560001",
    filing_compliance_score: 88,
    last_return_filed: "2024-11-30",
    months_since_last_filing: 1,
    annual_turnover_band: "10L-50L",
    shell_entity_risk_score: 12,
    shell_entity_signals: [],
    verified_at: now(),
  },
  "gst_verify_FAKE_GSTIN": {
    gstin: "27XXXXX0000X1ZY",
    legal_name: "SUSPICIOUS TRADING CO",
    trade_name: "SUSPICIOUS TRADING",
    registration_date: "2024-01-10",
    status: "active",
    business_type: "Proprietorship",
    principal_address: "Unknown Address",
    filing_compliance_score: 22,
    last_return_filed: "2024-02-28",
    months_since_last_filing: 10,
    annual_turnover_band: "0-1L",
    shell_entity_risk_score: 87,
    shell_entity_signals: [
      "registered_less_than_6_months_ago",
      "no_meaningful_turnover",
      "address_not_verifiable",
      "long_gap_in_filings",
    ],
    verified_at: now(),
  },

  // ── Dental Credential ────────────────────────────────────────────────────
  "dental_verify_MCI12345": {
    credential_id: "MCI12345",
    dentist_name: "DR RAJESH KUMAR SHARMA",
    degree: "BDS",
    registration_number: "MCI/BDS/2015/12345",
    council_name: "Dental Council of India",
    state: "Karnataka",
    registration_status: "active",
    registration_date: "2015-08-20",
    practice_years: 9,
    clinic_registrations: 1,
    credential_verified: true,
    risk_flags: [],
    verified_at: now(),
  },
  "dental_verify_FAKE": {
    credential_id: "FAKE99999",
    dentist_name: "UNKNOWN PERSON",
    degree: "BDS",
    registration_number: "INVALID",
    council_name: "Unknown",
    state: "Unknown",
    registration_status: "not_found",
    registration_date: "",
    practice_years: 0,
    clinic_registrations: 0,
    credential_verified: false,
    risk_flags: ["REGISTRATION_NOT_FOUND", "POSSIBLE_FAKE_DEGREE"],
    verified_at: now(),
  },

  // ── Fraud Registry ────────────────────────────────────────────────────────
  "fraud_query_ABCDE1234F": {
    entity_id: "ABCDE1234F",
    entity_type: "pan",
    risk_score: 8,
    fraud_signals: [],
    identity_layering_risk: false,
    known_bad_actor: false,
    last_checked: now(),
  },
  "fraud_query_ZZZZZ9999Z": {
    entity_id: "ZZZZZ9999Z",
    entity_type: "pan",
    risk_score: 91,
    fraud_signals: [
      {
        signal_id: "SIG-001",
        entity_type: "pan",
        entity_value: "ZZZZZ9999Z",
        signal_type: "IDENTITY_LAYERING",
        severity: "critical",
        description: "PAN used across 4 different loan applications in 3 banks in 6 months",
        source: "CROSS_BANK_BUREAU",
        reported_at: "2024-10-15T00:00:00Z",
      },
    ],
    identity_layering_risk: true,
    known_bad_actor: true,
    last_checked: now(),
  },

  // ── OCR Document Parse ────────────────────────────────────────────────────
  "ocr_parse_sample_pan.pdf": {
    document_id: "DOC-PAN-001",
    document_type: "PAN_CARD",
    extracted_fields: {
      pan_number: "ABCDE1234F",
      name: "RAJESH KUMAR SHARMA",
      date_of_birth: "1990-03-15",
      father_name: "SURESH SHARMA",
    },
    confidence_score: 96,
    tamper_detected: false,
    tamper_signals: [],
    ocr_quality: "high",
    parsed_at: now(),
  },
  "ocr_parse_tampered_itr.pdf": {
    document_id: "DOC-ITR-TAMPERED",
    document_type: "ITR",
    extracted_fields: {
      pan: "ABCDE1234F",
      assessment_year: "2023-24",
      gross_income: 2500000,
    },
    confidence_score: 61,
    tamper_detected: true,
    tamper_signals: [
      "FONT_INCONSISTENCY_DETECTED",
      "METADATA_DATE_MISMATCH",
      "PIXEL_ANOMALY_IN_INCOME_FIELD",
    ],
    ocr_quality: "medium",
    parsed_at: now(),
  },
};
