import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_accounts: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          cdp_account_id: string | null;
          address: string;
          chain: string;
          status: string;
          first_funded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          cdp_account_id?: string | null;
          address: string;
          chain?: string;
          status?: string;
          first_funded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          cdp_account_id?: string | null;
          address?: string;
          chain?: string;
          status?: string;
          first_funded_at?: string | null;
          created_at?: string;
        };
      };
      account_balances: {
        Row: {
          id: number;
          address: string;
          as_of: string;
          payload: any;
        };
        Insert: {
          id?: number;
          address: string;
          as_of?: string;
          payload: any;
        };
        Update: {
          id?: number;
          address?: string;
          as_of?: string;
          payload?: any;
        };
      };
      account_events: {
        Row: {
          id: number;
          address: string;
          occurred_at: string;
          kind: string;
          tx_hash: string | null;
          chain: string | null;
          details: any | null;
        };
        Insert: {
          id?: number;
          address: string;
          occurred_at: string;
          kind: string;
          tx_hash?: string | null;
          chain?: string | null;
          details?: any | null;
        };
        Update: {
          id?: number;
          address?: string;
          occurred_at?: string;
          kind?: string;
          tx_hash?: string | null;
          chain?: string | null;
          details?: any | null;
        };
      };
      rules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          rule_json: any;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          rule_json: any;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          rule_json?: any;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rule_evaluations: {
        Row: {
          id: string;
          rule_id: string;
          triggered: boolean;
          evaluation_data: any | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          triggered: boolean;
          evaluation_data?: any | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          triggered?: boolean;
          evaluation_data?: any | null;
          timestamp?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          rule_id: string;
          user_id: string;
          message: string;
          severity: string | null;
          acknowledged: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          user_id: string;
          message: string;
          severity?: string | null;
          acknowledged?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rule_id?: string;
          user_id?: string;
          message?: string;
          severity?: string | null;
          acknowledged?: boolean | null;
          created_at?: string;
        };
      };
    };
    Views: {
      portfolio_metrics: {
        Row: {
          user_id: string;
          address: string;
          total_usd_value: number | null;
          token_count: number | null;
        };
      };
      recent_account_activity: {
        Row: {
          user_id: string;
          address: string;
          occurred_at: string;
          kind: string;
          tx_hash: string | null;
          details: any | null;
        };
      };
    };
  };
}
