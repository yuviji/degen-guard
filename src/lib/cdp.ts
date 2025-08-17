import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from "dotenv";
import { supabase } from "./supabase";

dotenv.config();

if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
  throw new Error("Missing CDP_API_KEY_ID/CDP_API_KEY_SECRET environment variables");
}

// Create CDP client instance
export const cdp = new CdpClient();

export const EVM_NETWORK = "base";  // Base mainnet

/**
 * Get user's server wallet information
 */
export async function getServerWallet(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('address, status, cdp_account_id')
      .eq('user_id', userId)
      .eq('type', 'server')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      address: data.address,
      status: data.status,
      cdpAccountId: data.cdp_account_id
    };
  } catch (error) {
    console.error('Error fetching server wallet:', error);
    throw error;
  }
}
