# loan-verification-mcp-server

MCP server for **Stage 2: Commercial Loan Document Verification** — dental clinic loan workflow.

Exposes 10 tools across 5 domains, callable by Claude and any MCP-compatible AI agent.

---

## Tools Available

| Tool | Domain | Description |
|------|--------|-------------|
| `doc_parse_document` | Document | OCR parse + tamper detection |
| `doc_validate_document_set` | Document | Check completeness for loan type |
| `kyc_validate_pan` | KYC | PAN validation + watchlist screen |
| `kyc_verify_aadhaar` | KYC | Aadhaar identity + face match |
| `gst_verify_gstin` | GST | GST entity + shell detection |
| `gst_get_filing_history` | GST | Monthly filing trends |
| `fraud_query_registry` | Fraud | Cross-bank fraud signal lookup |
| `fraud_submit_signal` | Fraud | Write back new fraud signal |
| `credential_verify_dental` | Credential | DCI dental registration check |
| `orchestrate_stage2_verification` | Orchestration | A2A pipeline coordinator |
| `orchestrate_generate_verification_summary` | Orchestration | Final risk summary |

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Run with mock APIs (no real API keys needed)
npm start

# 4. Test with MCP Inspector
npm run inspect
```

---

## Deploy to AWS EC2

```bash
# On EC2 — install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone/upload project
scp -i your-key.pem -r ./loan-verification-mcp-server ec2-user@YOUR_EC2_IP:~/

# Install and build
cd loan-verification-mcp-server
npm install
npm run build

# Run as HTTP server (for Claude API integration)
TRANSPORT=http PORT=3001 npm start

# Keep alive with PM2
npm install -g pm2
pm2 start "TRANSPORT=http PORT=3001 npm start" --name loan-mcp
pm2 save
pm2 startup
```

### Nginx reverse proxy config
```nginx
location /loan-mcp/ {
    proxy_pass http://localhost:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Connect to Claude (claude_desktop_config.json)

For **local Claude Desktop** (stdio):
```json
{
  "mcpServers": {
    "loan-verification": {
      "command": "node",
      "args": ["/path/to/loan-verification-mcp-server/dist/index.js"],
      "env": {
        "USE_MOCK_APIS": "true"
      }
    }
  }
}
```

For **remote HTTP** (EC2):
```json
{
  "mcpServers": {
    "loan-verification": {
      "url": "http://YOUR_EC2_IP:3001/mcp"
    }
  }
}
```

---

## Switch to Real APIs

Set environment variables and set `USE_MOCK_APIS=false`:

```bash
export USE_MOCK_APIS=false
export PAN_API_KEY=your_nsdl_key
export GST_API_KEY=your_gst_key
export AADHAAR_API_KEY=your_uidai_key
export FRAUD_API_KEY=your_internal_key
export OCR_API_KEY=your_aws_textract_key
export DENTAL_API_KEY=your_dci_key

# Set real endpoints
export PAN_VERIFY_URL=https://your-pan-api.com/verify
export GST_VERIFY_URL=https://api.gst.gov.in/commonapi
export OCR_URL=https://your-aws-textract-wrapper.com
```

---

## Example Claude Conversation

```
User: I have a new dental clinic loan application. 
      Case ID: LOAN-2024-001
      Applicant: Dr. Rajesh Sharma, PAN: ABCDE1234F
      Loan type: clinic_setup
      Uploaded docs: PAN_CARD, AADHAAR, DENTAL_DEGREE_BDS, ITR, BANK_STATEMENT

Claude: [calls orchestrate_stage2_verification]
→ Gets execution plan with 7 steps

[calls doc_validate_document_set] → PASS: PROJECT_REPORT and LEASE_AGREEMENT missing
[asks user for missing docs]
[calls kyc_validate_pan + fraud_query_registry in parallel]
→ PAN: PASS | Fraud: PASS
[calls kyc_verify_aadhaar + credential_verify_dental]
→ Aadhaar: PASS | Credential: PASS (9 years practice)
[calls orchestrate_generate_verification_summary]
→ Risk score: 10/100 (LOW) | PROCEED TO STAGE 3
```

---

## Project Structure

```
src/
├── index.ts                    # Server entry point + transport config
├── constants.ts                # API endpoints, keys, thresholds
├── types/index.ts              # TypeScript domain types
├── services/
│   ├── apiClient.ts            # Shared HTTP client + utilities
│   └── mockData.ts             # Mock API responses for development
└── tools/
    ├── documentTools.ts        # OCR, document validation
    ├── kycTools.ts             # PAN, Aadhaar
    ├── gstTools.ts             # GST verification
    ├── fraudAndCredentialTools.ts  # Fraud registry, dental credentials
    └── orchestrationTools.ts   # A2A pipeline coordinator
```
