import axios, { AxiosInstance, AxiosError } from "axios";
import { API_KEYS, USE_MOCK_APIS } from "../constants.js";
import { mockResponses } from "./mockData.js";

// ─── Shared HTTP client ───────────────────────────────────────────────────────
export function createApiClient(baseURL: string, apiKey: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      
      "X-API-Key": apiKey,
    },
  });
}

// ─── Generic API caller with mock fallback ────────────────────────────────────
export async function callApi<T>(
  mockKey: string,
  realCall: () => Promise<T>
): Promise<T> {
  if (USE_MOCK_APIS) {
    const mock = mockResponses[mockKey];
    if (mock !== undefined) return mock as T;
    throw new Error(`No mock data for key: ${mockKey}. Set USE_MOCK_APIS=false or add mock.`);
  }
  try {
    return await realCall();
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      throw new Error(`API error (${status}): ${msg}`);
    }
    throw err;
  }
}

// ─── Utility: fuzzy name match score ─────────────────────────────────────────
export function nameMatchScore(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toUpperCase().replace(/[^A-Z ]/g, "").trim().split(/\s+/).sort().join(" ");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return Math.round((matches / longer.length) * 100);
}

// ─── Utility: hash string (for invoice dedup checks) ─────────────────────────
export function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ─── Utility: format risk level from score ───────────────────────────────────
export function riskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score < 25) return "low";
  if (score < 50) return "medium";
  if (score < 75) return "high";
  return "critical";
}

// ─── Utility: current ISO timestamp ──────────────────────────────────────────
export function now(): string {
  return new Date().toISOString();
}
