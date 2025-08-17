// Database Models
export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface Account {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  label?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AssetSnapshot {
  id: string;
  wallet_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  balance: string;
  usd_value: string;
  price_per_token: string;
  timestamp: Date;
}

export interface ChainEvent {
  id: string;
  wallet_id: string;
  transaction_hash: string;
  block_number: number;
  event_type: 'transfer' | 'swap' | 'deposit' | 'withdrawal';
  from_address?: string;
  to_address?: string;
  token_address?: string;
  amount?: string;
  usd_value?: string;
  timestamp: Date;
}

export interface Rule {
  id: string;
  user_id: string;
  name: string;
  description: string;
  rule_json: RuleDefinition;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RuleEvaluation {
  id: string;
  rule_id: string;
  triggered: boolean;
  evaluation_data: any;
  timestamp: Date;
}

export interface Alert {
  id: string;
  rule_id: string;
  user_id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
  created_at: Date;
}

// Rule DSL Types
export interface RuleTrigger {
  metric: string;
  op: '<' | '>' | '=' | '<=' | '>=' | '!=';
  value: number;
}

export interface RuleAction {
  type: 'ALERT';
  message: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface RuleDefinition {
  triggers: RuleTrigger[];
  logic: 'ALL' | 'ANY';
  scope?: {
    wallet_ids?: string[];
    chains?: string[];
  };
  actions: RuleAction[];
}

// API Types
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

export interface WalletBalance {
  address: string;
  chain: string;
  balances: Array<{
    token_address: string;
    symbol: string;
    name: string;
    balance: string;
    usd_value: string;
  }>;
}

// CDP API Response Types
export interface CDPBalance {
  amount: string;
  currency: {
    code: string;
    name: string;
    address?: string;
  };
  usd_value?: {
    amount: string;
    currency: string;
  };
}

export interface CDPTransaction {
  id: string;
  hash: string;
  block_height: number;
  block_timestamp: string;
  type: string;
  from_address: string;
  to_address: string;
  value?: {
    amount: string;
    currency: string;
  };
}

export interface CDPPrice {
  amount: string;
  currency: string;
  base: string;
}
