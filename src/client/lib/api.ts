// API service layer for DegenGuard frontend
import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Portfolio API
export const portfolioApi = {
  getOverview: () => 
    apiRequest<PortfolioMetrics>('/api/portfolio/overview'),
  
  getHistory: (days: number = 7) => 
    apiRequest<Array<{ timestamp: string; total_value: number }>>(`/api/portfolio/history?days=${days}`),
  
  getTransactions: (limit: number = 50) => 
    apiRequest<Array<any>>(`/api/portfolio/transactions?limit=${limit}`),
};

// Accounts API (EVM Accounts)
export const accountsApi = {
  getAll: () => 
    apiRequest<Array<Account>>('/api/accounts'),
  
  create: (address?: string, chain?: string, label?: string) =>
    apiRequest<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ address, chain, label }),
    }),
  
  getBalances: (address: string) =>
    apiRequest<Array<any>>(`/api/accounts/${address}/balances`),
  
  getTransactions: (address: string, limit: number = 50) =>
    apiRequest<Array<any>>(`/api/accounts/${address}/transactions?limit=${limit}`),
  
  delete: (address: string) =>
    apiRequest<{ message: string }>(`/api/accounts/${address}`, { method: 'DELETE' }),
};

// Legacy alias for backward compatibility
export const walletsApi = accountsApi;

// Rules API
export const rulesApi = {
  getAll: () => 
    apiRequest<Array<Rule>>('/api/rules'),
  
  createFromLanguage: (naturalLanguage: string, name?: string) =>
    apiRequest<Rule>('/api/rules/from-language', {
      method: 'POST',
      body: JSON.stringify({ naturalLanguage, name }),
    }),
  
  create: (name: string, description: string, ruleJson: RuleDefinition) =>
    apiRequest<Rule>('/api/rules', {
      method: 'POST',
      body: JSON.stringify({ name, description, ruleJson }),
    }),
  
  updateStatus: (ruleId: string, isActive: boolean) =>
    apiRequest<Rule>(`/api/rules/${ruleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  
  getEvaluations: (ruleId: string, limit: number = 50) =>
    apiRequest<Array<any>>(`/api/rules/${ruleId}/evaluations?limit=${limit}`),
  
  delete: (ruleId: string) =>
    apiRequest<{ message: string }>(`/api/rules/${ruleId}`, { method: 'DELETE' }),
  
  explain: (ruleId: string) =>
    apiRequest<{ explanation: string }>(`/api/rules/${ruleId}/explain`, { method: 'POST' }),
};

// Alerts API
export const alertsApi = {
  getAll: (acknowledged?: boolean) => {
    const params = new URLSearchParams();
    if (acknowledged !== undefined) {
      params.append('acknowledged', acknowledged.toString());
    }
    const queryString = params.toString();
    return apiRequest<Array<Alert>>(`/api/alerts${queryString ? `?${queryString}` : ''}`);
  },
  
  acknowledge: (alertId: string) =>
    apiRequest<Alert>(`/api/alerts/${alertId}/acknowledge`, { method: 'PATCH' }),
  
  acknowledgeAll: () =>
    apiRequest<{ acknowledged_count: number }>('/api/alerts/acknowledge-all', {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),
  
  delete: (alertId: string) =>
    apiRequest<{ message: string }>(`/api/alerts/${alertId}`, { method: 'DELETE' }),
  
  getStats: () =>
    apiRequest<{
      total_alerts: number;
      unacknowledged_alerts: number;
      high_severity_alerts: number;
      alerts_last_24h: number;
    }>('/api/alerts/stats'),
};

// Health check
export const healthApi = {
  check: () => apiRequest<{ status: string; timestamp: string }>('/api/health'),
};

// Types (these should match the backend types)
export interface PortfolioMetrics {
  total_usd_value: number;
  daily_pnl_pct: number;
  stablecoin_allocation_pct: number;
  largest_position_pct: number;
  asset_allocations: Array<{
    symbol: string;
    allocation_pct: number;
    usd_value: number;
  }>;
}

export interface Account {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  label?: string;
  created_at: string;
  updated_at: string;
}

// Legacy alias for backward compatibility
export interface Wallet extends Account {}

export interface Rule {
  id: string;
  user_id: string;
  name: string;
  description: string;
  rule_json: RuleDefinition;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleDefinition {
  triggers: Array<{
    metric: string;
    operator: string;
    value: number;
    timeframe?: string;
  }>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
  }>;
}

export interface Alert {
  id: string;
  user_id: string;
  rule_id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
  rule_name?: string;
  rule_description?: string;
}

export { ApiError };
