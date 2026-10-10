import type {
  Dashboard,
  LoginResponse,
  Market,
  MarketCreate,
  Report,
  ScanResult,
  SuggestRequest,
  SuggestResponse,
} from "../types";
import { api, type AuthedApi } from "./client";
import { isNotFound } from "./errors";

const post = (body?: unknown): RequestInit => ({ method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const login = (email: string, password: string) => api<LoginResponse>("/auth/login", post({ email, password }));

export const listMarkets = (request: AuthedApi) => request<Market[]>("/markets");

export const getMarket = (request: AuthedApi, id: number) => request<Market>(`/markets/${id}`);

export const createMarket = (request: AuthedApi, body: MarketCreate) => request<Market>("/markets", post(body));

export const suggestMarket = (request: AuthedApi, body: SuggestRequest) => request<SuggestResponse>("/markets/suggest", post(body));

export const getDashboard = (request: AuthedApi, id: number) => request<Dashboard>(`/markets/${id}/dashboard`);

export const scanMarket = (request: AuthedApi, id: number) => request<ScanResult>(`/markets/${id}/scan`, post());

export const generateWeeklyReport = (request: AuthedApi, id: number) => request<Report>(`/markets/${id}/reports/weekly`, post());

/** Resolves to null when the market has no report yet (404). */
export async function getLatestReport(request: AuthedApi, id: number): Promise<Report | null> {
  try {
    return await request<Report | null>(`/markets/${id}/reports/latest`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
