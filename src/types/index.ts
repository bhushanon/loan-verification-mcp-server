// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface DocumentParseResult {
  document_id: string;
  document_type: DocumentType;
  extracted_fields: Record<string, string | number | boolean | null>;
  confidence_score: number; // 0-100
  tamper_detected: boolean;
  tamper_signals: string[];
  ocr_quality: "high" | "medium" | "low";
  parsed_at: string;
}

export type DocumentType =
  | "PAN_CARD"
  | "AADHAAR"
  | "ITR"
  | "BANK_STATEMENT"
  | "GST_CERTIFICATE"
  | "DENTAL_DEGREE_BDS"
  | "DENTAL_DEGREE_MDS"
  | "MACHINERY_INVOICE"
  | "LEASE_AGREEMENT"
  | "PROJECT_REPORT"
  | "UDYAM_CERTIFICATE"
  | "UNKNOWN";

export interface PANValidationResult {
  pan: string;
  valid_format: boolean;
  name_on_pan: string;
  name_match_score: number; // 0-100
  pan_type: "individual" | "company" | "trust" | "unknown";
  dedup_status: "clean" | "duplicate_within_bank" | "watchlist_hit";
  watchlist_flags: string[];
  validated_at: string;
}

export interface AadhaarVerificationResult {
  aadhaar_last4: string;
  name_match: boolean;
  name_match_score: number;
  address_consistency: boolean;
  address_risk_signals: string[];
  face_match_score: number | null; // null if no photo provided
  verification_status: "verified" | "mismatch" | "not_found" | "error";
  verified_at: string;
}

export interface GSTVerificationResult {
  gstin: string;
  legal_name: string;
  trade_name: string;
  registration_date: string;
  status: "active" | "cancelled" | "suspended" | "provisional";
  business_type: string;
  principal_address: string;
  filing_compliance_score: number; // 0-100
  last_return_filed: string;
  months_since_last_filing: number;
  annual_turnover_band: string;
  shell_entity_risk_score: number; // 0-100
  shell_entity_signals: string[];
  verified_at: string;
}

export interface FraudSignal {
  signal_id: string;
  entity_type: "pan" | "gstin" | "aadhaar" | "phone" | "account" | "invoice";
  entity_value: string;
  signal_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  source: string;
  reported_at: string;
}

export interface FraudRegistryQueryResult {
  entity_id: string;
  entity_type: string;
  risk_score: number; // 0-100
  fraud_signals: FraudSignal[];
  identity_layering_risk: boolean;
  known_bad_actor: boolean;
  last_checked: string;
}

export interface DentalCredentialResult {
  credential_id: string;
  dentist_name: string;
  degree: "BDS" | "MDS" | "BOTH";
  registration_number: string;
  council_name: string;
  state: string;
  registration_status: "active" | "suspended" | "revoked" | "not_found";
  registration_date: string;
  practice_years: number;
  clinic_registrations: number;
  credential_verified: boolean;
  risk_flags: string[];
  verified_at: string;
}

export interface CaseContext {
  case_id: string;
  applicant_pan: string;
  applicant_name: string;
  loan_type: "equipment" | "working_capital" | "clinic_setup" | "expansion";
  loan_amount: number;
  stage: number;
  created_at: string;
  last_updated: string;
}

export interface VerificationSummary {
  [key: string]: any;
  case_id: string;
  overall_risk_score: number; // 0-100
  risk_level: "low" | "medium" | "high" | "critical";
  verification_statuses: {
    pan: "pass" | "fail" | "pending";
    aadhaar: "pass" | "fail" | "pending";
    gst: "pass" | "fail" | "pending" | "not_applicable";
    credential: "pass" | "fail" | "pending";
    fraud_check: "pass" | "fail" | "pending";
    documents: "pass" | "fail" | "pending";
  };
  blocking_issues: string[];
  warnings: string[];
  proceed_to_next_stage: boolean;
  recommended_actions: string[];
  summary_generated_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
