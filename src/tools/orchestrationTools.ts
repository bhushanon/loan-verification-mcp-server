import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { riskLevel, now } from "../services/apiClient.js";
import type { VerificationSummary } from "../types/index.js";

export function registerOrchestrationTools(server: McpServer): void {

  const orchestrateStage2VerificationSchema = z.object({
    case_id: z.string().describe("Unique loan application case ID"),
    applicant_pan: z.string().length(10).describe("Applicant's PAN number"),
    applicant_name: z.string().describe("Full applicant name"),
    loan_type: z.enum(["clinic_setup", "equipment", "working_capital", "expansion"]),
    uploaded_docs: z.array(z.string()).describe("List of uploaded document type keys"),
    gstin: z.string().optional().describe("GSTIN if business entity is involved"),
    dental_registration_number: z.string().optional().describe("DCI registration number"),
  });
  // ── Tool 1: Run Full Stage 2 Verification Pipeline ─────────────────────
  server.registerTool(
    "orchestrate_stage2_verification",
    {
      title: "Run Full Stage 2 Verification Pipeline",
      description: `Orchestrates the complete Stage 2 verification workflow for a dental clinic loan.
This is the A2A coordination tool — it defines the sequence of checks and aggregates results.

Claude should call this FIRST for a new loan case, then execute each step by calling 
the individual tools in the recommended sequence.

Args:
  - case_id: Unique loan application ID
  - applicant_pan: Applicant's PAN
  - applicant_name: Full name
  - loan_type: Type of loan
  - uploaded_docs: List of uploaded document type strings
  - gstin: (optional) GST number if entity is registered

Returns a complete execution plan with:
  {
    "pipeline_id": string,
    "execution_sequence": [{
      "step": number,
      "tool": string,          // Exact tool name to call
      "params": object,        // Params to pass to that tool
      "depends_on": number[],  // Steps that must pass first
      "blocking": boolean      // If this fails, stop pipeline
    }],
    "estimated_steps": number,
    "instructions": string     // Guidance for Claude on how to execute
  }

Use this as your workflow map. Execute each step, check verdicts, stop on BLOCK.`,
      inputSchema: orchestrateStage2VerificationSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ case_id, applicant_pan, applicant_name, loan_type, uploaded_docs, gstin, dental_registration_number }: z.infer<typeof orchestrateStage2VerificationSchema>) => {
      const sequence = [
        {
          step: 1,
          tool: "doc_validate_document_set",
          params: { loan_type, uploaded_documents: uploaded_docs },
          depends_on: [],
          blocking: true,
          description: "Check all required documents are uploaded before starting verification",
        },
        {
          step: 2,
          tool: "kyc_validate_pan",
          params: { pan: applicant_pan, applicant_name, check_dedup: true },
          depends_on: [1],
          blocking: true,
          description: "Validate PAN, check watchlists, verify name match",
        },
        {
          step: 3,
          tool: "fraud_query_registry",
          params: { entity_type: "pan", entity_value: applicant_pan, case_id },
          depends_on: [1],
          blocking: true,
          description: "Check PAN against fraud registry — runs in parallel with step 2",
        },
        {
          step: 4,
          tool: "kyc_verify_aadhaar",
          params: { aadhaar_last4: "PENDING_INPUT", name_on_application: applicant_name, address_state: "PENDING_INPUT" },
          depends_on: [2],
          blocking: true,
          description: "Verify Aadhaar identity — request Aadhaar last 4 digits from applicant",
        },
        {
          step: 5,
          tool: "credential_verify_dental",
          params: {
            registration_number: dental_registration_number || "PENDING_INPUT",
            dentist_name: applicant_name,
            degree_type: "BDS",
          },
          depends_on: [2],
          blocking: true,
          description: "Verify DCI registration — critical fraud check for dental loans",
        },
        ...(gstin ? [{
          step: 6,
          tool: "gst_verify_gstin",
          params: { gstin, entity_name: applicant_name, context: "borrower" },
          depends_on: [2],
          blocking: false,
          description: "Verify GST entity — non-blocking, flag if issues",
        }] : []),
        {
          step: gstin ? 7 : 6,
          tool: "orchestrate_generate_verification_summary",
          params: { case_id },
          depends_on: [2, 3, 4, 5, ...(gstin ? [6] : [])],
          blocking: false,
          description: "Generate final verification summary with overall risk verdict",
        },
      ];

      const output = {
        pipeline_id: `PIPE-${case_id}`,
        case_id,
        loan_type,
        execution_sequence: sequence,
        estimated_steps: sequence.length,
        parallel_groups: [
          { group: 1, steps: [1], description: "Document completeness check" },
          { group: 2, steps: [2, 3], description: "PAN + fraud check — run in parallel" },
          { group: 3, steps: [4, 5, ...(gstin ? [6] : [])], description: "Aadhaar + credential + GST — run in parallel" },
          { group: 4, steps: [sequence.length], description: "Summary aggregation" },
        ],
        instructions: `EXECUTION GUIDE FOR CLAUDE:
1. Run Group 1 first (doc_validate_document_set). If BLOCK → stop.
2. Run Group 2 tools in parallel (kyc_validate_pan + fraud_query_registry). 
   If either returns BLOCK → stop and escalate.
3. Run Group 3 tools in parallel (Aadhaar, dental credential, GST if applicable).
   Note: step 4 needs Aadhaar last 4 digits — ask user if not provided.
   Note: step 5 needs DCI registration number — ask user if not provided.
4. Run final summary tool.
5. Report full summary to case management system.
STOP CONDITION: Any tool returning risk_verdict=BLOCK halts the pipeline.`,
        created_at: now(),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    }
  );

  const orchestrateGenerateVerificationSummarySchema = z.object({
    case_id: z.string(),
    pan_verdict: z.enum(["pass", "fail", "pending"]).default("pending"),
    aadhaar_verdict: z.enum(["pass", "fail", "pending"]).default("pending"),
    credential_verdict: z.enum(["pass", "fail", "pending"]).default("pending"),
    fraud_verdict: z.enum(["pass", "fail", "pending"]).default("pending"),
    gst_verdict: z.enum(["pass", "fail", "pending", "not_applicable"]).default("not_applicable"),
    blocking_issues: z.array(z.string()).default([]).describe("List of BLOCK reasons"),
    warnings: z.array(z.string()).default([]).describe("List of FLAG/warning reasons"),
  });
  // ── Tool 2: Generate Verification Summary ─────────────────────────────────
  server.registerTool(
    "orchestrate_generate_verification_summary",
    {
      title: "Generate Stage 2 Verification Summary",
      description: `Aggregates results from all Stage 2 verification tools into a final summary.
Call this AFTER running all individual verification tools.

Args:
  - case_id: Loan case ID
  - pan_verdict: Result from kyc_validate_pan (pass/fail/pending)
  - aadhaar_verdict: Result from kyc_verify_aadhaar
  - credential_verdict: Result from credential_verify_dental
  - fraud_verdict: Result from fraud_query_registry
  - gst_verdict: Result from gst_verify_gstin (optional)
  - blocking_issues: List of BLOCK reasons discovered during pipeline
  - warnings: List of FLAG reasons

Returns a VerificationSummary that can be sent to the BPM orchestrator 
(Camunda/Temporal) to advance the loan case to Stage 3 or route to exception handling.`,
      inputSchema: orchestrateGenerateVerificationSummarySchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ case_id, pan_verdict, aadhaar_verdict, credential_verdict, fraud_verdict, gst_verdict, blocking_issues, warnings }: z.infer<typeof orchestrateGenerateVerificationSummarySchema>) => {
      const verdicts = { pan: pan_verdict, aadhaar: aadhaar_verdict, gst: gst_verdict, credential: credential_verdict, fraud_check: fraud_verdict, documents: "pass" as const };

      const failed = Object.values(verdicts).filter(v => v === "fail").length;
      const pending = Object.values(verdicts).filter(v => v === "pending").length;

      const overallScore = blocking_issues.length > 0 ? 85
        : failed > 0 ? 65
        : warnings.length > 2 ? 45
        : warnings.length > 0 ? 25
        : 10;

      const proceed = blocking_issues.length === 0 && pending === 0;

      const recommended: string[] = [];
      if (blocking_issues.length > 0) recommended.push("ESCALATE to fraud team immediately");
      if (warnings.length > 0) recommended.push("REVIEW warnings with credit officer before Stage 3");
      if (proceed) recommended.push("ADVANCE to Stage 3: Project & Machinery Validation");
      if (pending > 0) recommended.push(`COLLECT pending information: ${Object.entries(verdicts).filter(([,v]) => v === "pending").map(([k]) => k).join(", ")}`);

      const summary: VerificationSummary = {
        case_id,
        overall_risk_score: overallScore,
        risk_level: riskLevel(overallScore),
        verification_statuses: verdicts,
        blocking_issues,
        warnings,
        proceed_to_next_stage: proceed,
        recommended_actions: recommended,
        summary_generated_at: now(),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        structuredContent: summary,
      };
    }
  );
}
