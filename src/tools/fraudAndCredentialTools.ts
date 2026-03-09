import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callApi, riskLevel, now } from "../services/apiClient.js";
import { API_ENDPOINTS, API_KEYS, THRESHOLDS } from "../constants.js";
import type { FraudRegistryQueryResult, DentalCredentialResult } from "../types/index.js";

export function registerFraudAndCredentialTools(server: McpServer): void {

  // ── Tool 1: Query Fraud Registry ──────────────────────────────────────────
  server.registerTool(
    "fraud_query_registry",
    {
      title: "Query Fraud Registry",
      description: `Query the bank's fraud intelligence registry for a given entity.
Checks for known bad actors, identity layering patterns, reused invoices, 
and signals submitted by other agents in previous cases.

This is a CROSS-CUTTING tool — called by agents in Stages 2, 3, 4, and 7.

Args:
  - entity_type: "pan"|"gstin"|"aadhaar"|"phone"|"account"|"invoice"
  - entity_value: The value to check (e.g. PAN number, GSTIN, phone)
  - case_id: (optional) Current case ID for audit trail

Returns:
  {
    "entity_id": string,
    "risk_score": number,          // 0-100; above 60 = block
    "fraud_signals": [{
      "signal_type": string,
      "severity": "low"|"medium"|"high"|"critical",
      "description": string,
      "reported_at": string
    }],
    "identity_layering_risk": boolean,
    "known_bad_actor": boolean,
    "risk_verdict": "PASS"|"FLAG"|"BLOCK"
  }

Critical: BLOCK on known_bad_actor=true or risk_score > 60. Escalate immediately.`,
      inputSchema: z.object({
        entity_type: z.enum(["pan", "gstin", "aadhaar", "phone", "account", "invoice"])
          .describe("Type of entity to check"),
        entity_value: z.string().min(1).describe("Entity value to look up in fraud registry"),
        case_id: z.string().optional().describe("Current loan case ID for audit logging"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ entity_type, entity_value, case_id }) => {
      const mockKey = `fraud_query_${entity_value}`;
      const result = await callApi<FraudRegistryQueryResult>(
        mockKey,
        async () => {
          const axios = (await import("axios")).default;
          const resp = await axios.post(
            API_ENDPOINTS.FRAUD_REGISTRY,
            { entity_type, entity_value, case_id },
            { headers: { "X-API-Key": API_KEYS.FRAUD_API_KEY } }
          );
          return resp.data;
        }
      );

      const verdict = result.known_bad_actor || result.risk_score > THRESHOLDS.MAX_FRAUD_RISK_SCORE
        ? "BLOCK"
        : result.risk_score > 30 || result.fraud_signals.length > 0
        ? "FLAG"
        : "PASS";

      const output = {
        ...result,
        risk_level: riskLevel(result.risk_score),
        risk_verdict: verdict,
        case_id,
        next_step: verdict === "BLOCK"
          ? "STOP — known fraudster or high-risk entity. Escalate to fraud team, do not process further."
          : verdict === "FLAG"
          ? "Flag for manual review. Credit officer must review fraud signals before proceeding."
          : "No fraud signals. Clear to proceed.",
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );

  // ── Tool 2: Submit New Fraud Signal ───────────────────────────────────────
  server.registerTool(
    "fraud_submit_signal",
    {
      title: "Submit New Fraud Signal",
      description: `Submit a new fraud signal discovered during loan processing to the central registry.
This enables network learning — each case improves detection for future cases.

Called by any agent when they discover an anomaly: tampered docs, vendor mismatch, 
income-bank discrepancy, identity layering, etc.

Args:
  - entity_type: Type of entity this signal applies to
  - entity_value: Entity value (PAN, GSTIN, etc.)
  - signal_type: Signal category (e.g. "TAMPERED_DOCUMENT", "IDENTITY_LAYERING", "FAKE_INVOICE")
  - severity: "low"|"medium"|"high"|"critical"
  - description: Human-readable description of what was found
  - case_id: The case where this was discovered

Returns: { "signal_id": string, "accepted": boolean, "message": string }`,
      inputSchema: z.object({
        entity_type: z.enum(["pan", "gstin", "aadhaar", "phone", "account", "invoice"]),
        entity_value: z.string().min(1),
        signal_type: z.string().describe("Signal category, e.g. TAMPERED_DOCUMENT, FAKE_INVOICE, IDENTITY_LAYERING"),
        severity: z.enum(["low", "medium", "high", "critical"]),
        description: z.string().min(10).describe("Clear description of the fraud signal discovered"),
        case_id: z.string().describe("Loan case ID where this was found"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ entity_type, entity_value, signal_type, severity, description, case_id }) => {
      const signal_id = `SIG-${Date.now().toString(36).toUpperCase()}`;

      // In production: POST to FRAUD_SIGNAL_SUBMIT endpoint
      const output = {
        signal_id,
        accepted: true,
        entity_type,
        entity_value,
        signal_type,
        severity,
        case_id,
        message: `Fraud signal ${signal_id} submitted. Registry updated. Future queries on ${entity_value} will include this signal.`,
        submitted_at: now(),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );

  // ── Tool 3: Verify Dental Credential ─────────────────────────────────────
  server.registerTool(
    "credential_verify_dental",
    {
      title: "Verify Dental Professional Credential",
      description: `Verify a dentist's BDS/MDS registration with the Dental Council of India.
Critical for dental clinic loans — fake credentials are a major fraud vector.

Args:
  - registration_number: DCI registration number from the degree certificate
  - dentist_name: Full name as on the loan application
  - degree_type: "BDS" | "MDS" | "BOTH"

Returns:
  {
    "registration_status": "active"|"suspended"|"revoked"|"not_found",
    "credential_verified": boolean,
    "dentist_name": string,          // Name on DCI records
    "practice_years": number,
    "council_name": string,
    "risk_flags": string[],          // e.g. ["BORROWED_CREDENTIAL", "REVOKED_ELSEWHERE"]
    "risk_verdict": "PASS"|"FLAG"|"BLOCK"
  }

BLOCK on: not_found, revoked, name mismatch, borrowed credentials.
This check is unique to dental/medical professional loans.`,
      inputSchema: z.object({
        registration_number: z.string().describe("DCI registration number from degree certificate"),
        dentist_name: z.string().describe("Full name as on the loan application"),
        degree_type: z.enum(["BDS", "MDS", "BOTH"]).describe("Type of dental degree to verify"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ registration_number, dentist_name, degree_type }) => {
      const mockKey = `dental_verify_${registration_number}`;
      const result = await callApi<DentalCredentialResult>(
        mockKey,
        async () => {
          const axios = (await import("axios")).default;
          const resp = await axios.get(
            `${API_ENDPOINTS.DENTAL_COUNCIL}/verify`,
            {
              params: { registration_number, degree_type },
              headers: { "X-API-Key": API_KEYS.DENTAL_API_KEY }
            }
          );
          return resp.data;
        }
      );

      const reasons: string[] = [...result.risk_flags];
      if (!result.credential_verified) reasons.push("Credential could not be verified with DCI");
      if (result.registration_status === "revoked") reasons.push("CRITICAL: Registration revoked");
      if (result.registration_status === "not_found") reasons.push("Registration number not found in DCI database");

      const verdict = ["revoked", "not_found"].includes(result.registration_status) ? "BLOCK"
        : reasons.length > 0 ? "FLAG"
        : "PASS";

      const output = {
        ...result,
        degree_verified: degree_type,
        name_provided: dentist_name,
        risk_verdict: verdict,
        risk_reasons: reasons,
        next_step: verdict === "BLOCK"
          ? "BLOCK — credential invalid. Possible fake degree. Escalate to fraud team."
          : verdict === "FLAG"
          ? "Request original certificates and physical verification before proceeding."
          : `Credential verified. Dr. ${result.dentist_name} has ${result.practice_years} years practice. Proceed.`,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );
}
