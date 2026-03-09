import { AxiosInstance } from "axios";
export declare function createApiClient(baseURL: string, apiKey: string): AxiosInstance;
export declare function callApi<T>(mockKey: string, realCall: () => Promise<T>): Promise<T>;
export declare function nameMatchScore(a: string, b: string): number;
export declare function hashString(input: string): string;
export declare function riskLevel(score: number): "low" | "medium" | "high" | "critical";
export declare function now(): string;
//# sourceMappingURL=apiClient.d.ts.map