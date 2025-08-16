// API service layer for DegenGuard frontend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
}

function getUserIdFromToken(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
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
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
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
  getOverview: () => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<PortfolioMetrics>(`/api/portfolio/overview?userId=${userId}`);
  },
  
  getHistory: (days: number = 7) => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Array<{ timestamp: string; total_value: number }>>(`/api/portfolio/history?userId=${userId}&days=${days}`);
  },
  
  getTransactions: (limit: number = 50) => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Array<any>>(`/api/portfolio/transactions?userId=${userId}&limit=${limit}`);
  },
};

// Wallets API
export const walletsApi = {
  getAll: () => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Array<Wallet>>(`/api/wallets?userId=${userId}`);
  },
  
  add: (address: string, chain: string, label?: string) => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Wallet>('/api/wallets', {
      method: 'POST',
      body: JSON.stringify({ userId, address, chain, label }),
    });
  },
  
  getBalances: (walletId: string) =>
    apiRequest<Array<any>>(`/api/wallets/${walletId}/balances`),
  
  getTransactions: (walletId: string, limit: number = 50) =>
    apiRequest<Array<any>>(`/api/wallets/${walletId}/transactions?limit=${limit}`),
  
  delete: (walletId: string) =>
    apiRequest<{ message: string }>(`/api/wallets/${walletId}`, { method: 'DELETE' }),
};

// Rules API
export const rulesApi = {
  getAll: () => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Array<Rule>>(`/api/rules?userId=${userId}`);
  },
  
  createFromLanguage: (naturalLanguage: string, name?: string) => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Rule>('/api/rules/from-language', {
      method: 'POST',
      body: JSON.stringify({ userId, naturalLanguage, name }),
    });
  },
  
  create: (name: string, description: string, ruleJson: RuleDefinition) => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<Rule>('/api/rules', {
      method: 'POST',
      body: JSON.stringify({ userId, name, description, ruleJson }),
    });
  },
  
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
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    const params = new URLSearchParams();
    params.append('userId', userId);
    if (acknowledged !== undefined) {
      params.append('acknowledged', acknowledged.toString());
    }
    const queryString = params.toString();
    return apiRequest<Array<Alert>>(`/api/alerts?${queryString}`);
  },
  
  acknowledge: (alertId: string) =>
    apiRequest<Alert>(`/api/alerts/${alertId}/acknowledge`, { method: 'PATCH' }),
  
  acknowledgeAll: () => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<{ acknowledged_count: number }>('/api/alerts/acknowledge-all', {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    });
  },
  
  delete: (alertId: string) =>
    apiRequest<{ message: string }>(`/api/alerts/${alertId}`, { method: 'DELETE' }),
  
  getStats: () => {
    const userId = getUserIdFromToken();
    if (!userId) throw new Error('User not authenticated');
    return apiRequest<{
      total_alerts: number;
      unacknowledged_alerts: number;
      high_severity_alerts: number;
      alerts_last_24h: number;
    }>(`/api/alerts/stats?userId=${userId}`);
  },
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

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  label?: string;
  created_at: string;
  updated_at: string;
}

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
