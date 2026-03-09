"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerKycTools = registerKycTools;
const zod_1 = require("zod");
const apiClient_js_1 = require("../services/apiClient.js");
const constants_js_1 = require("../constants.js");
function registerKycTools(server) {
    // ── Tool 1: Validate PAN ──────────────────────────────────────────────────
    server.registerTool("kyc_validate_pan", {
        title: "Validate PAN Card",
        description: `Validate a PAN number against NSDL, verify name match, check for duplicates 
within bank, and screen against watchlists (PMLA, court orders, OFAC).

Args:
  - pan: 10-character PAN number (e.g. "ABCDE1234F")
  - applicant_name: Full name as given in the application
  - check_dedup: Whether to check if this PAN is used by another customer in the bank

Returns:
  {
    "pan": string,
    "valid_format": boolean,
    "name_on_pan": string,
    "name_match_score": number,     // 0-100; below 75 = flag
    "pan_type": "individual"|"company"|"trust"|"unknown",
    "dedup_status": "clean"|"duplicate_within_bank"|"watchlist_hit",
    "watchlist_flags": string[],
    "risk_verdict": "PASS"|"FLAG"|"BLOCK",
    "risk_reasons": string[],
    "validated_at": string
  }

Risk verdicts: PASS = proceed, FLAG = need explanation, BLOCK = stop application.
Watchlist hits → always BLOCK and escalate to fraud team.`,
        inputSchema: zod_1.z.object({
            pan: zod_1.z.string().length(10).toUpperCase().describe("10-character PAN number"),
            applicant_name: zod_1.z.string().min(2).describe("Full name as given in application"),
            check_dedup: zod_1.z.boolean().default(true).describe("Check for duplicate PAN in bank records"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ pan, applicant_name, check_dedup }) => {
        const mockKey = `pan_verify_${pan}`;
        const result = await (0, apiClient_js_1.callApi)(mockKey, async () => {
            const axios = (await import("axios")).default;
            const resp = await axios.post(constants_js_1.API_ENDPOINTS.PAN_VERIFY, { pan, check_dedup }, { headers: { "X-API-Key": constants_js_1.API_KEYS.PAN_API_KEY } });
            return resp.data;
        });
        // Compute name match if not in mock
        const matchScore = result.name_match_score ?? (0, apiClient_js_1.nameMatchScore)(applicant_name, result.name_on_pan);
        const reasons = [];
        if (!result.valid_format)
            reasons.push("PAN format invalid");
        if (matchScore < constants_js_1.THRESHOLDS.MIN_NAME_MATCH_SCORE) {
            reasons.push(`Name mismatch: application says "${applicant_name}", PAN shows "${result.name_on_pan}" (score: ${matchScore})`);
        }
        if (result.dedup_status === "duplicate_within_bank") {
            reasons.push("PAN already exists in bank records under different customer");
        }
        if (result.watchlist_flags.length > 0) {
            reasons.push(`Watchlist hit: ${result.watchlist_flags.join(", ")}`);
        }
        const verdict = result.watchlist_flags.length > 0 ? "BLOCK"
            : reasons.length > 0 ? "FLAG"
                : "PASS";
        const output = {
            ...result,
            name_match_score: matchScore,
            risk_verdict: verdict,
            risk_reasons: reasons,
            next_step: verdict === "BLOCK"
                ? "Escalate to fraud team immediately. Do not proceed."
                : verdict === "FLAG"
                    ? "Collect explanation from applicant and RM sign-off before proceeding."
                    : "Proceed to Aadhaar verification.",
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── Tool 2: Verify Aadhaar ────────────────────────────────────────────────
    server.registerTool("kyc_verify_aadhaar", {
        title: "Verify Aadhaar Identity",
        description: `Verify Aadhaar identity via UIDAI. Checks name consistency, address signals,
and optionally face match for video KYC flows.

Args:
  - aadhaar_last4: Last 4 digits of Aadhaar (we never store full Aadhaar)
  - name_on_application: Name as given in the application
  - address_state: State declared in the application
  - face_image_reference: (optional) Reference to face photo for video KYC face match

Returns:
  {
    "name_match": boolean,
    "name_match_score": number,
    "address_consistency": boolean,
    "address_risk_signals": string[],
    "face_match_score": number|null,
    "verification_status": "verified"|"mismatch"|"not_found"|"error",
    "risk_verdict": "PASS"|"FLAG"|"BLOCK",
    "risk_reasons": string[]
  }

Note: Aadhaar is never stored in full. Only last 4 digits used for reference.`,
        inputSchema: zod_1.z.object({
            aadhaar_last4: zod_1.z.string().length(4).describe("Last 4 digits of Aadhaar number"),
            name_on_application: zod_1.z.string().describe("Name as given in the loan application"),
            address_state: zod_1.z.string().describe("State declared in the application"),
            face_image_reference: zod_1.z.string().optional().describe("Optional: face image reference for video KYC"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ aadhaar_last4, name_on_application, address_state, face_image_reference }) => {
        const mockKey = `aadhaar_verify_${aadhaar_last4}`;
        const result = await (0, apiClient_js_1.callApi)(mockKey, async () => {
            const axios = (await import("axios")).default;
            const resp = await axios.post(constants_js_1.API_ENDPOINTS.AADHAAR_VERIFY, { aadhaar_last4, face_image_reference }, { headers: { "X-API-Key": constants_js_1.API_KEYS.AADHAAR_API_KEY } });
            return resp.data;
        });
        const reasons = [];
        if (result.verification_status === "not_found")
            reasons.push("Aadhaar number not found in UIDAI database");
        if (!result.name_match)
            reasons.push(`Name mismatch (score: ${result.name_match_score})`);
        if (!result.address_consistency)
            reasons.push("Address does not match Aadhaar records");
        if (result.address_risk_signals.length > 0)
            reasons.push(`Address signals: ${result.address_risk_signals.join(", ")}`);
        if (face_image_reference && result.face_match_score !== null && result.face_match_score < constants_js_1.THRESHOLDS.MIN_FACE_MATCH_SCORE) {
            reasons.push(`Face match failed (score: ${result.face_match_score}/100, minimum: ${constants_js_1.THRESHOLDS.MIN_FACE_MATCH_SCORE})`);
        }
        const verdict = result.verification_status === "not_found" ? "BLOCK"
            : reasons.length >= 2 ? "BLOCK"
                : reasons.length === 1 ? "FLAG"
                    : "PASS";
        const output = {
            ...result,
            risk_verdict: verdict,
            risk_reasons: reasons,
            next_step: verdict === "BLOCK"
                ? "Block application — identity could not be verified."
                : verdict === "FLAG"
                    ? "Request additional identity proof from applicant."
                    : "KYC complete. Proceed to professional credential check.",
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
}
//# sourceMappingURL=kycTools.js.map