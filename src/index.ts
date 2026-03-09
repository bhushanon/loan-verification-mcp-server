import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerDocumentTools } from "./tools/documentTools.js";
import { registerKycTools } from "./tools/kycTools.js";
import { registerGstTools } from "./tools/gstTools.js";
import { registerFraudAndCredentialTools } from "./tools/fraudAndCredentialTools.js";
import { registerOrchestrationTools } from "./tools/orchestrationTools.js";

// ─── Create MCP Server ────────────────────────────────────────────────────────
const server = new McpServer({
  name: "loan-verification-mcp-server",
  version: "1.0.0",
});

// ─── Register all tool groups ─────────────────────────────────────────────────
registerDocumentTools(server);        // OCR, document parsing, completeness check
registerKycTools(server);             // PAN, Aadhaar verification
registerGstTools(server);             // GST entity verification, filing history
registerFraudAndCredentialTools(server); // Fraud registry, dental credential
registerOrchestrationTools(server);   // A2A pipeline coordinator, summary

console.error("✅ Registered tools: doc, kyc, gst, fraud, credential, orchestration");

// ─── HTTP Transport (for AWS EC2 deployment) ──────────────────────────────────
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "loan-verification-mcp-server", version: "1.0.0" });
  });

  // MCP endpoint
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3001");
  app.listen(port, () => {
    console.error(`🚀 MCP server running at http://localhost:${port}/mcp`);
    console.error(`🔍 Health: http://localhost:${port}/health`);
    console.error(`🔧 Mock APIs: ${process.env.USE_MOCK_APIS !== "false" ? "ON" : "OFF"}`);
  });
}

// ─── STDIO Transport (for local Claude Desktop integration) ──────────────────
async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
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
} else {
  runStdio().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
