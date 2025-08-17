import { generateJwt } from "@coinbase/cdp-sdk/auth";

export interface JwtParams {
  requestMethod: string;
  requestHost: string;
  requestPath: string;
  expiresIn?: number;
}

/**
 * Generate JWT token for Coinbase CDP API authentication
 */
export async function generateCdpJwt(params: JwtParams): Promise<string> {
  const token = await generateJwt({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    requestMethod: params.requestMethod,
    requestHost: params.requestHost,
    requestPath: params.requestPath,
    expiresIn: params.expiresIn || 120 // Default to 120 seconds
  });
  
  return token;
}

/**
 * Generate JWT specifically for On-Ramp API calls
 */
export async function generateOnRampJwt(): Promise<string> {
  return generateCdpJwt({
    requestMethod: 'POST',
    requestHost: 'api.developer.coinbase.com',
    requestPath: '/onramp/v1/buy/quote'
  });
}

/**
 * Generate JWT specifically for Session Token API calls
 */
export async function generateSessionTokenJwt(): Promise<string> {
  return generateCdpJwt({
    requestMethod: 'POST',
    requestHost: 'api.developer.coinbase.com',
    requestPath: '/onramp/v1/token'
  });
}
