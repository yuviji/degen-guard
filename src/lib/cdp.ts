import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from "dotenv";
import { db } from "./db";

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
export async function getServerWallet(userId: number) {
  try {
    const { rows } = await db.query(
      `SELECT address, status, cdp_account_id
       FROM user_accounts
       WHERE user_id = $1 AND type = 'server'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return null;
    }

    return {
      address: rows[0].address,
      status: rows[0].status,
      cdpAccountId: rows[0].cdp_account_id
    };
  } catch (error) {
    console.error('Error fetching server wallet:', error);
    throw error;
  }
}
