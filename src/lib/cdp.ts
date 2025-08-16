import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
  throw new Error("Missing CDP_API_KEY_ID/CDP_API_KEY_SECRET environment variables");
}

// Create CDP client instance
export const cdp = new CdpClient();

export const EVM_NETWORK = "base";  // Base mainnet
