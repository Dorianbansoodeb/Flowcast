const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export const ACCOUNT_ID = "acct_main";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Mock-User": "user_demo",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface User {
  id: string;
  email: string;
  name: string;
  business: string;
  account_id: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  category: string;
  merchant_name: string;
  is_income: boolean;
  created_at?: string;
}

export interface ForecastPoint {
  date: string;
  balance: number;
  lower: number;
  upper: number;
  net_flow: number;
}

export interface Forecast {
  account_id: string;
  current_balance: number;
  income_30d: number;
  expenses_30d: number;
  projected_runway_days: number;
  forecast: ForecastPoint[];
  model: string;
}

export interface AlertItem {
  type: string;
  risk_level: string;
  message: string;
  predicted_date?: string;
  predicted_balance?: number;
  threshold: number;
}

export interface AlertsResponse {
  account_id: string;
  overall_risk: string;
  threshold: number;
  alerts: AlertItem[];
}

export interface ApiCostSummary {
  account_id: string;
  period_days: number;
  total_cost_usd: number;
  total_calls: number;
  failed_calls: number;
  by_endpoint: { endpoint: string; calls: number; cost_usd: number; failures: number }[];
  most_expensive: { endpoint: string; calls: number; cost_usd: number; failures: number }[];
}

export interface ApiInsight {
  pattern: string;
  severity: string;
  endpoint: string;
  message: string;
  suggestion: string;
  estimated_savings_usd: number;
}

export interface ApiInsightsResponse {
  account_id: string;
  patterns: ApiInsight[];
  total_estimated_savings_usd: number;
  summary: ApiCostSummary;
}

export interface PlaidStatus {
  plaid_configured: boolean;
  plaid_env: string | null;
  linked: boolean;
  institution_name: string | null;
  item_id: string | null;
  transaction_count: number;
}

export interface PlaidLinkToken {
  link_token: string;
  expiration?: string;
  plaid_env: string;
}

export interface PlaidExchangeResult {
  message: string;
  account_id: string;
  item_id: string;
  institution_name: string | null;
  sync: {
    added: number;
    modified: number;
    removed: number;
    current_balance: number;
  };
}

export const api = {
  getMe: () => request<User>("/auth/me"),
  getTransactions: (accountId = ACCOUNT_ID) =>
    request<Transaction[]>(`/transactions?account_id=${accountId}`),
  mockLoad: (accountId = ACCOUNT_ID) =>
    request<{ transactions_created: number }>("/transactions/mock-load", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId, seed_api: true }),
    }),
  getForecast: (accountId = ACCOUNT_ID) =>
    request<Forecast>(`/forecast/${accountId}`),
  getAlerts: (accountId = ACCOUNT_ID) =>
    request<AlertsResponse>(`/alerts/${accountId}`),
  getApiCostSummary: (accountId = ACCOUNT_ID, days = 30) =>
    request<ApiCostSummary>(`/api-costs/summary?account_id=${accountId}&days=${days}`),
  getApiCostTimeline: (accountId = ACCOUNT_ID, days = 14) =>
    request<{ timeline: { date: string; calls: number; cost_usd: number; failures: number }[] }>(
      `/api-costs/timeline?account_id=${accountId}&days=${days}`
    ),
  getApiInsights: (accountId = ACCOUNT_ID) =>
    request<ApiInsightsResponse>(`/api-costs/insights?account_id=${accountId}`),
  mockApiCall: (endpoint: string, status = 200) =>
    request<{ cost_usd: number }>("/api-costs/mock-call", {
      method: "POST",
      body: JSON.stringify({ endpoint, account_id: ACCOUNT_ID, status }),
    }),
  getPlaidStatus: (accountId = ACCOUNT_ID) =>
    request<PlaidStatus>(`/plaid/status?account_id=${accountId}`),
  createPlaidLinkToken: (accountId = ACCOUNT_ID) =>
    request<PlaidLinkToken>("/plaid/link-token", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId }),
    }),
  exchangePlaidPublicToken: (publicToken: string, accountId = ACCOUNT_ID) =>
    request<PlaidExchangeResult>("/plaid/exchange-public-token", {
      method: "POST",
      body: JSON.stringify({ public_token: publicToken, account_id: accountId }),
    }),
  syncPlaidTransactions: (accountId = ACCOUNT_ID, replaceExisting = false) =>
    request<PlaidExchangeResult["sync"]>("/plaid/sync-transactions", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        replace_existing: replaceExisting,
      }),
    }),
};
