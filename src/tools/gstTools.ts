import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callApi, now } from "../services/apiClient.js";
import { API_ENDPOINTS, API_KEYS, THRESHOLDS } from "../constants.js";
import type { GSTVerificationResult } from "../types/index.js";

export function registerGstTools(server: McpServer): void {

  // ── Tool 1: Verify GSTIN ──────────────────────────────────────────────────
  server.registerTool(
    "gst_verify_gstin",
    {
      title: "Verify GST Registration",
      description: `Verify a GSTIN against the GST portal, check filing compliance, detect shell entities.
This is the primary GST check used in Stage 2 (business verification) and reused in Stage 3 (vendor checks).

Args:
  - gstin: 15-character GSTIN (e.g. "29ABCDE1234F1Z5")
  - entity_name: Declared entity name to match against GST records

Returns:
  {
    "gstin": string,
    "legal_name": string,
    "status": "active"|"cancelled"|"suspended"|"provisional",
    "filing_compliance_score": number,    // 0-100
    "months_since_last_filing": number,
    "annual_turnover_band": string,
    "shell_entity_risk_score": number,    // 0-100; above 40 = high risk
    "shell_entity_signals": string[],
    "risk_verdict": "PASS"|"FLAG"|"BLOCK",
    "risk_reasons": string[],
    "verified_at": string
  }

Shell entity signals include: new registration, no turnover, address issues, filing gaps.
This resource is shared with Stage 3 vendor tools — no re-verification needed.`,
      inputSchema: z.object({
        gstin: z.string().length(15).describe("15-character GSTIN"),
        entity_name: z.string().describe("Declared entity/applicant name to validate against GST records"),
        context: z.enum(["borrower", "vendor"]).default("borrower")
          .describe("Whether checking for loan applicant or equipment vendor"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ gstin, entity_name, context }) => {
      const mockKey = `gst_verify_${gstin}`;
      const result = await callApi<GSTVerificationResult>(
        mockKey,
        async () => {
          const axios = (await import("axios")).default;
          const resp = await axios.get(
            `${API_ENDPOINTS.GST_VERIFY}/${gstin}`,
            { headers: { "X-API-Key": API_KEYS.GST_API_KEY } }
          );
          return resp.data;
        }
      );

      const reasons: string[] = [];
      if (result.status !== "active") reasons.push(`GST registration is ${result.status}`);
      if (result.shell_entity_risk_score > THRESHOLDS.MAX_SHELL_ENTITY_SCORE) {
        reasons.push(`High shell entity risk (${result.shell_entity_risk_score}/100)`);
        reasons.push(...result.shell_entity_signals);
      }
      if (result.months_since_last_filing > THRESHOLDS.MAX_GST_MONTHS_UNFILED) {
        reasons.push(`No GST filing in last ${result.months_since_last_filing} months`);
      }
      if (result.filing_compliance_score < 50) {
        reasons.push(`Poor filing compliance score: ${result.filing_compliance_score}/100`);
      }

      const verdict = result.status !== "active" || result.shell_entity_risk_score > 70 ? "BLOCK"
        : reasons.length > 0 ? "FLAG"
        : "PASS";

      const output = {
        ...result,
        entity_name_provided: entity_name,
        context,
        risk_verdict: verdict,
        risk_reasons: reasons,
        next_step: verdict === "BLOCK"
          ? `Block — GST entity invalid or high shell risk. Do not proceed with ${context}.`
          : verdict === "FLAG"
          ? "Flag for credit officer review. Collect explanation for filing gaps."
          : `GST verification passed for ${context}. Resource available for Stage 3 vendor checks.`,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );

  // ── Tool 2: Get GST Filing History ────────────────────────────────────────
  server.registerTool(
    "gst_get_filing_history",
    {
      title: "Get GST Filing History",
      description: `Retrieve month-by-month GST filing history for a GSTIN.
Used to detect cash flow patterns, seasonality, and diversion signals in WC monitoring (Stage 7).

Args:
  - gstin: 15-character GSTIN
  - months: Number of months of history to retrieve (default: 12, max: 36)

Returns:
  {
    "gstin": string,
    "filing_history": [{ "period": "MMYYYY", "filed": boolean, "taxable_turnover": number, "tax_paid": number }],
    "trend": "growing"|"stable"|"declining"|"erratic",
    "average_monthly_turnover": number,
    "missed_filings": string[],
    "diversion_signals": string[]
  }

Use in Stage 7 working capital monitoring to verify monthly business activity.`,
      inputSchema: z.object({
        gstin: z.string().length(15).describe("15-character GSTIN"),
        months: z.number().int().min(1).max(36).default(12).describe("Months of history to retrieve"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ gstin, months }) => {
      // Mock: generate synthetic filing history
      const history = Array.from({ length: months }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const period = `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
        const filed = Math.random() > 0.15;
        return {
          period,
          filed,
          taxable_turnover: filed ? Math.floor(Math.random() * 400000) + 100000 : 0,
          tax_paid: filed ? Math.floor(Math.random() * 50000) + 5000 : 0,
        };
      });

      const missed = history.filter(h => !h.filed).map(h => h.period);
      const turnovers = history.filter(h => h.filed).map(h => h.taxable_turnover);
      const avg = turnovers.length ? Math.round(turnovers.reduce((a, b) => a + b, 0) / turnovers.length) : 0;

      const output = {
        gstin,
        months_requested: months,
        filing_history: history,
        trend: missed.length > months * 0.3 ? "erratic" : avg > 200000 ? "growing" : "stable",
        average_monthly_turnover: avg,
        missed_filings: missed,
        diversion_signals: missed.length > 3 ? ["MULTIPLE_MISSED_FILINGS"] : [],
        retrieved_at: now(),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );
}
