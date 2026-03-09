"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const documentTools_js_1 = require("./tools/documentTools.js");
const kycTools_js_1 = require("./tools/kycTools.js");
const gstTools_js_1 = require("./tools/gstTools.js");
const fraudAndCredentialTools_js_1 = require("./tools/fraudAndCredentialTools.js");
const orchestrationTools_js_1 = require("./tools/orchestrationTools.js");
// ─── Create MCP Server ────────────────────────────────────────────────────────
const server = new mcp_js_1.McpServer({
    name: "loan-verification-mcp-server",
    version: "1.0.0",
});
// ─── Register all tool groups ─────────────────────────────────────────────────
(0, documentTools_js_1.registerDocumentTools)(server); // OCR, document parsing, completeness check
(0, kycTools_js_1.registerKycTools)(server); // PAN, Aadhaar verification
(0, gstTools_js_1.registerGstTools)(server); // GST entity verification, filing history
(0, fraudAndCredentialTools_js_1.registerFraudAndCredentialTools)(server); // Fraud registry, dental credential
(0, orchestrationTools_js_1.registerOrchestrationTools)(server); // A2A pipeline coordinator, summary
console.error("✅ Registered tools: doc, kyc, gst, fraud, credential, orchestration");
// ─── HTTP Transport (for AWS EC2 deployment) ──────────────────────────────────
async function runHTTP() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Health check endpoint
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", server: "loan-verification-mcp-server", version: "1.0.0" });
    });
    // MCP endpoint
    app.post("/mcp", async (req, res) => {
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });
    const port = parseInt(process.env.PORT || "3001");
    console.debug('running at '+ port);
    app.listen(port, () => {
        console.error(`🚀 MCP server running at http://localhost:${port}/mcp`);
        console.error(`🔍 Health: http://localhost:${port}/health`);
        console.error(`🔧 Mock APIs: ${process.env.USE_MOCK_APIS !== "false" ? "ON" : "OFF"}`);
    });
}
// ─── STDIO Transport (for local Claude Desktop integration) ──────────────────
async function runStdio() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 MCP server running via stdio");
}
// ─── Choose transport based on environment ────────────────────────────────────
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
    runHTTP().catch((err) => {
        console.error("Server error:", err);
        process.exit(1);
    });
}
else {
    runStdio().catch((err) => {
        console.error("Server error:", err);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map