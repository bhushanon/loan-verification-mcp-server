"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDocumentTools = registerDocumentTools;
const zod_1 = require("zod");
const apiClient_js_1 = require("../services/apiClient.js");
const constants_js_1 = require("../constants.js");
function registerDocumentTools(server) {
    // ── Tool 1: Parse Document ────────────────────────────────────────────────
    server.registerTool("doc_parse_document", {
        title: "Parse and Classify Document",
        description: `OCR-parse an uploaded document, classify its type, extract fields, and detect tampering.
      
Supports: PAN, Aadhaar, ITR, Bank Statement, GST Certificate, BDS/MDS Degree, 
Machinery Invoice, Lease Agreement, Project Report, Udyam Certificate.

Args:
  - file_reference: File path or reference ID from the document upload (e.g. "uploads/pan_card.pdf")
  - expected_type: (optional) Expected document type to validate against

Returns:
  {
    "document_id": string,        // Unique ID for this parsed doc (use in downstream tools)
    "document_type": string,      // Classified type
    "extracted_fields": object,   // All extracted key-value pairs
    "confidence_score": number,   // 0-100, below 70 needs manual review
    "tamper_detected": boolean,
    "tamper_signals": string[],   // e.g. ["FONT_INCONSISTENCY", "METADATA_MISMATCH"]
    "ocr_quality": "high"|"medium"|"low",
    "parsed_at": string
  }

Use when: Starting verification of any uploaded document.
Watch for: tamper_detected=true or confidence_score < 70 — route to manual review.`,
        inputSchema: zod_1.z.object({
            file_reference: zod_1.z.string().describe("File path or upload reference ID"),
            expected_type: zod_1.z.string().optional().describe("Optional: expected document type for validation"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ file_reference, expected_type }) => {
        const mockKey = `ocr_parse_${file_reference}`;
        const result = await (0, apiClient_js_1.callApi)(mockKey, async () => {
            const axios = (await import("axios")).default;
            const resp = await axios.post(constants_js_1.API_ENDPOINTS.OCR_PARSE, { file_reference, expected_type }, { headers: { "X-API-Key": constants_js_1.API_KEYS.OCR_API_KEY } });
            return resp.data;
        });
        const issues = [];
        if (result.tamper_detected) {
            issues.push(`⚠️ TAMPERING DETECTED: ${result.tamper_signals.join(", ")}`);
        }
        if (result.confidence_score < constants_js_1.THRESHOLDS.MIN_CONFIDENCE_SCORE) {
            issues.push(`⚠️ LOW OCR CONFIDENCE: ${result.confidence_score}/100 — manual review required`);
        }
        if (expected_type && result.document_type !== expected_type) {
            issues.push(`⚠️ TYPE MISMATCH: Expected ${expected_type}, got ${result.document_type}`);
        }
        const output = {
            ...result,
            routing_decision: issues.length > 0 ? "MANUAL_REVIEW" : "AUTO_PROCEED",
            issues,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── Tool 2: Validate Document Set Completeness ────────────────────────────
    server.registerTool("doc_validate_document_set", {
        title: "Validate Required Document Set",
        description: `Check if all mandatory documents for a specific loan type have been uploaded.
Returns a checklist with missing/present status for each required document.

Loan types: "clinic_setup" | "equipment" | "working_capital" | "expansion"

Returns:
  {
    "complete": boolean,
    "loan_type": string,
    "checklist": [{ "document": string, "status": "present"|"missing"|"expired", "notes": string }],
    "missing_documents": string[],
    "can_proceed": boolean
  }

Use when: Before starting verification pipeline to ensure no documents are missing.`,
        inputSchema: zod_1.z.object({
            loan_type: zod_1.z.enum(["clinic_setup", "equipment", "working_capital", "expansion"])
                .describe("Type of loan being applied for"),
            uploaded_documents: zod_1.z.array(zod_1.z.string())
                .describe("List of document types already uploaded (use document_type from doc_parse_document)"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ loan_type, uploaded_documents }) => {
        const requirements = {
            clinic_setup: ["PAN_CARD", "AADHAAR", "DENTAL_DEGREE_BDS", "ITR", "BANK_STATEMENT", "PROJECT_REPORT", "LEASE_AGREEMENT"],
            equipment: ["PAN_CARD", "AADHAAR", "DENTAL_DEGREE_BDS", "ITR", "BANK_STATEMENT", "MACHINERY_INVOICE"],
            working_capital: ["PAN_CARD", "AADHAAR", "ITR", "BANK_STATEMENT", "GST_CERTIFICATE"],
            expansion: ["PAN_CARD", "AADHAAR", "DENTAL_DEGREE_BDS", "ITR", "BANK_STATEMENT", "GST_CERTIFICATE", "UDYAM_CERTIFICATE"],
        };
        const required = requirements[loan_type];
        const uploaded = new Set(uploaded_documents);
        const checklist = required.map(doc => ({
            document: doc,
            status: uploaded.has(doc) ? "present" : "missing",
            notes: uploaded.has(doc) ? "Document uploaded" : `Upload ${doc.replace(/_/g, " ").toLowerCase()} to proceed`,
        }));
        const missing = checklist.filter(c => c.status === "missing").map(c => c.document);
        const output = {
            complete: missing.length === 0,
            loan_type,
            checklist,
            missing_documents: missing,
            can_proceed: missing.length === 0,
            checked_at: (0, apiClient_js_1.now)(),
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
}
//# sourceMappingURL=documentTools.js.map