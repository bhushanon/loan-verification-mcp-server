"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiClient = createApiClient;
exports.callApi = callApi;
exports.nameMatchScore = nameMatchScore;
exports.hashString = hashString;
exports.riskLevel = riskLevel;
exports.now = now;
const axios_1 = __importStar(require("axios"));
const constants_js_1 = require("../constants.js");
const mockData_js_1 = require("./mockData.js");
// ─── Shared HTTP client ───────────────────────────────────────────────────────
function createApiClient(baseURL, apiKey) {
    return axios_1.default.create({
        baseURL,
        timeout: 15000,
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
        },
    });
}
// ─── Generic API caller with mock fallback ────────────────────────────────────
async function callApi(mockKey, realCall) {
    if (constants_js_1.USE_MOCK_APIS) {
        const mock = mockData_js_1.mockResponses[mockKey];
        if (mock !== undefined)
            return mock;
        throw new Error(`No mock data for key: ${mockKey}. Set USE_MOCK_APIS=false or add mock.`);
    }
    try {
        return await realCall();
    }
    catch (err) {
        if (err instanceof axios_1.AxiosError) {
            const status = err.response?.status;
            const msg = err.response?.data?.message || err.message;
            throw new Error(`API error (${status}): ${msg}`);
        }
        throw err;
    }
}
// ─── Utility: fuzzy name match score ─────────────────────────────────────────
function nameMatchScore(a, b) {
    const normalize = (s) => s.toUpperCase().replace(/[^A-Z ]/g, "").trim().split(/\s+/).sort().join(" ");
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb)
        return 100;
    const longer = na.length > nb.length ? na : nb;
    const shorter = na.length > nb.length ? nb : na;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i]))
            matches++;
    }
    return Math.round((matches / longer.length) * 100);
}
// ─── Utility: hash string (for invoice dedup checks) ─────────────────────────
function hashString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}
// ─── Utility: format risk level from score ───────────────────────────────────
function riskLevel(score) {
    if (score < 25)
        return "low";
    if (score < 50)
        return "medium";
    if (score < 75)
        return "high";
    return "critical";
}
// ─── Utility: current ISO timestamp ──────────────────────────────────────────
function now() {
    return new Date().toISOString();
}
//# sourceMappingURL=apiClient.js.map