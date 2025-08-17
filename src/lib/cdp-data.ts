import { CdpClient } from "@coinbase/cdp-sdk";
import { Alchemy, Network } from "alchemy-sdk";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Simple rate limiter for CDP API calls
 * Ensures we don't exceed 5 requests per second
 */
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number = 5, timeWindowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async waitForAvailableSlot(): Promise<void> {
    const now = Date.now();
    
    // Remove requests older than the time window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindow);
    
    // If we're at the limit, wait until we can make another request
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest) + 10; // Add 10ms buffer
      
      if (waitTime > 0) {
        console.log(`Rate limiting: waiting ${waitTime}ms before next CDP API call`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Record this request
    this.requests.push(Date.now());
  }
}

// Create rate limiter instance
const cdpRateLimiter = new RateLimiter(4, 1000); // Use 4 requests/second to be safe

if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
  throw new Error("Missing CDP_API_KEY_ID/CDP_API_KEY_SECRET environment variables");
}

// Create CDP client instance for data operations
export const cdpData = new CdpClient();

// Create Alchemy client instance for pricing data
const alchemy = new Alchemy({ 
  apiKey: process.env.ALCHEMY_API_KEY || "demo" 
});

export const SUPPORTED_NETWORKS = {
  BASE_MAINNET: "base",
  BASE_SEPOLIA: "base-sepolia", 
  ETHEREUM: "ethereum"
} as const;

export type SupportedNetwork = typeof SUPPORTED_NETWORKS[keyof typeof SUPPORTED_NETWORKS];

/**
 * Alchemy price data interfaces
 */
export interface AlchemyTokenPrice {
  contractAddress: string;
  price?: number;
  symbol?: string;
}

/**
 * Portfolio data interfaces
 */
export interface TokenBalance {
  token: {
    contractAddress: string;
    name?: string;
    symbol?: string;
    decimals: number;
  };
  amount: {
    amount: string;
    decimals: number;
  };
  usdValue: number;
  humanReadableAmount: number;
}

export interface PortfolioSnapshot {
  address: string;
  network: SupportedNetwork;
  balances: TokenBalance[];
  totalUsdValue: number;
  timestamp: Date;
}

export interface HistoricalBalance {
  timestamp: Date;
  totalValue: number;
  address: string;
}

/**
 * Get ETH price from Alchemy SDK
 */
async function getEthPrice(): Promise<number> {
  if (!process.env.ALCHEMY_API_KEY) {
    console.warn('ALCHEMY_API_KEY not set, using fallback ETH price');
    return 3200;
  }

  try {
    const symbols = ["ETH"];
    const data = await alchemy.prices.getTokenPriceBySymbol(symbols);
    
    const ethPrice = data.data?.find((token: any) => token.symbol === 'ETH')?.prices?.[0]?.value;
    return ethPrice ? parseFloat(ethPrice) : 3200;
  } catch (error) {
    console.error('Error fetching ETH price from Alchemy:', error);
    return 3200; // Fallback price
  }
}

/**
 * Get token prices from Alchemy SDK
 */
async function getTokenPrices(contractAddresses: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  if (contractAddresses.length === 0 || !process.env.ALCHEMY_API_KEY) {
    return priceMap;
  }

  try {
    // Format addresses for Alchemy SDK - using Base network
    const addresses = contractAddresses.map(address => ({
      network: Network.BASE_MAINNET,
      address: address
    }));

    const data = await alchemy.prices.getTokenPriceByAddress(addresses);
    
    // Map contract addresses to USD prices
    if (data.data) {
      data.data.forEach((tokenData: any) => {
        if (tokenData?.address && tokenData?.prices?.[0]?.value) {
          priceMap.set(tokenData.address.toLowerCase(), parseFloat(tokenData.prices[0].value));
        }
      });
    }

    return priceMap;
  } catch (error) {
    console.error('Error fetching token prices from Alchemy:', error);
    return priceMap;
  }
}

/**
 * Enrich token balances with USD prices from Alchemy
 */
async function enrichWithAlchemyPrices(
  balances: Omit<TokenBalance, 'usdValue'>[],
  address: `0x${string}`,
  network: SupportedNetwork
): Promise<TokenBalance[]> {
  try {
    // Get unique contract addresses for price lookup
    const contractAddresses = balances
      .map(balance => balance.token.contractAddress)
      .filter(addr => addr !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'); // Exclude native ETH

    // Fetch prices from Alchemy
    const priceMap = await getTokenPrices(contractAddresses);

    // Fetch real ETH price from Alchemy
    const ethPrice = await getEthPrice();

    return balances.map(balance => {
      let usdValue = 0;
      
      if (balance.token.contractAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        // Native ETH
        usdValue = balance.humanReadableAmount * ethPrice;
      } else {
        // ERC-20 token
        const price = priceMap.get(balance.token.contractAddress.toLowerCase()) || 0;
        usdValue = balance.humanReadableAmount * price;
      }

      return {
        ...balance,
        usdValue
      };
    });

  } catch (error) {
    console.error('Error enriching with Alchemy prices:', error);
    return balances.map(balance => ({ ...balance, usdValue: 0 }));
  }
}

/**
 * Get current token balances for an address using CDP Token Balances API
 */
export async function getTokenBalances(
  address: `0x${string}`, 
  network: SupportedNetwork = SUPPORTED_NETWORKS.BASE_MAINNET
): Promise<TokenBalance[]> {
  try {
    // Wait for rate limiter before making the request
    await cdpRateLimiter.waitForAvailableSlot();
    
    const result = await cdpData.evm.listTokenBalances({
      address,
      network,
    });

    const balances = result.balances.map(balance => {
      const humanReadableAmount = Number(balance.amount.amount) / Math.pow(10, balance.amount.decimals);
      return {
        token: {
          contractAddress: balance.token.contractAddress,
          name: balance.token.name,
          symbol: balance.token.symbol,
          decimals: balance.amount.decimals,
        },
        amount: {
          amount: balance.amount.amount.toString(),
          decimals: balance.amount.decimals,
        },
        humanReadableAmount,
        usdValue: 0, // Will be enriched with price data
      };
    });

    // Enrich with real Alchemy prices
    return await enrichWithAlchemyPrices(balances, address, network);
  } catch (error) {
    console.error(`Error fetching token balances for ${address}:`, error);
    throw error;
  }
}

/**
 * Get portfolio snapshot with USD values using CDP APIs
 */
export async function getPortfolioSnapshot(
  address: `0x${string}`,
  network: SupportedNetwork = SUPPORTED_NETWORKS.BASE_MAINNET
): Promise<PortfolioSnapshot> {
  try {
    const balances = await getTokenBalances(address, network);
    
    // TODO: Integrate with price API to get USD values
    const totalUsdValue = balances.reduce((sum, balance) => sum + (balance.usdValue || 0), 0);

    return {
      address,
      network,
      balances,
      totalUsdValue,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`Error getting portfolio snapshot for ${address}:`, error);
    throw error;
  }
}

/**
 * Query historical data using CDP SQL API
 */
export async function queryHistoricalData(sqlQuery: string): Promise<any[]> {
  try {
    // Wait for rate limiter before making the request
    await cdpRateLimiter.waitForAvailableSlot();
    
    // Use OnchainKit API key for SQL API authentication
    const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
    
    if (!apiKey) {
      throw new Error("Missing NEXT_PUBLIC_ONCHAINKIT_API_KEY environment variable");
    }
    
    const response = await fetch('https://api.cdp.coinbase.com/platform/v2/data/query/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: sqlQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL API request failed: ${response.statusText} - ${errorText}`);
    }

    const responseText = await response.text();
    
    // Check if response is HTML (service outage) instead of JSON
    if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
      throw new Error('CDP API service is currently unavailable. Please check https://status.coinbase.com');
    }
    
    try {
      const data = JSON.parse(responseText);
      return data.rows || [];
    } catch (parseError) {
      throw new Error(`Invalid JSON response from CDP API: ${responseText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error('Error executing SQL query:', error);
    
    // Check if it's a service outage error
    if (error instanceof Error && error.message.includes('CDP API service is currently unavailable')) {
      console.warn('CDP API service is down, returning empty result set');
      return []; // Return empty array instead of throwing
    }
    
    throw error;
  }
}

/**
 * Get historical balance data for an address using SQL API
 */
export async function getHistoricalBalances(
  address: string,
  days: number = 7,
  network: string = 'base'
): Promise<HistoricalBalance[]> {
  const sqlQuery = `
    SELECT 
      block_timestamp,
      parameters
    FROM base.events 
    WHERE event_signature = 'Transfer(address,address,uint256)'
      AND (parameters['from'] = '${address.toLowerCase()}' OR parameters['to'] = '${address.toLowerCase()}')
      AND action = 1
    ORDER BY block_timestamp DESC
    LIMIT 100
  `;
  console.log("SQL QUERY:", sqlQuery)

  try {
    const rows = await queryHistoricalData(sqlQuery);
    
    // Process rows to calculate balance changes
    const balanceMap = new Map<string, number>();
    
    rows.forEach(row => {
      const timestamp = new Date(row.block_timestamp).toISOString();
      const params = row.parameters || {};
      
      // Extract Transfer event parameters
      const fromAddress = params.from?.toLowerCase();
      const toAddress = params.to?.toLowerCase();
      const value = parseFloat(params.value || '0');
      
      if (!balanceMap.has(timestamp)) {
        balanceMap.set(timestamp, 0);
      }
      
      // Add value if receiving, subtract if sending
      if (toAddress === address.toLowerCase()) {
        balanceMap.set(timestamp, balanceMap.get(timestamp)! + value);
      } else if (fromAddress === address.toLowerCase()) {
        balanceMap.set(timestamp, balanceMap.get(timestamp)! - value);
      }
    });
    
    // Convert map to array and sort by timestamp
    return Array.from(balanceMap.entries())
      .map(([timestamp, balanceChange]) => ({
        timestamp: new Date(timestamp),
        totalValue: balanceChange,
        address,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
  } catch (error) {
    console.error('Error fetching historical balances:', error);
    
    // If CDP service is down, return mock/fallback data to keep UI functional
    if (error instanceof Error && error.message.includes('CDP API service is currently unavailable')) {
      console.warn('CDP service down, returning fallback historical data');
      return [{
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        totalValue: 0,
        address,
      }];
    }
    
    return [];
  }
}

/**
 * Get transaction history for an address using SQL API
 */
export async function getTransactionHistory(
  address: string,
  limit: number = 50,
  network: string = 'base'
): Promise<any[]> {
  const sqlQuery = `
    SELECT 
      transaction_hash,
      block_number,
      block_timestamp,
      from_address,
      to_address,
      value
    FROM base.transactions 
    WHERE (from_address = '${address.toLowerCase()}' OR to_address = '${address.toLowerCase()}')
      AND action = 1
    ORDER BY block_timestamp DESC
    LIMIT ${limit}
  `;

  try {
    return await queryHistoricalData(sqlQuery);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    
    // If CDP service is down, return empty array gracefully
    if (error instanceof Error && error.message.includes('CDP API service is currently unavailable')) {
      console.warn('CDP service down, transaction history unavailable');
    }
    
    return [];
  }
}

/**
 * Get DeFi positions and interactions using SQL API
 */
export async function getDeFiPositions(
  address: string,
  network: string = 'base'
): Promise<any[]> {
  const sqlQuery = `
    SELECT 
      address as contract_address,
      event_signature,
      event_name,
      parameters,
      parameter_types,
      block_timestamp,
      transaction_hash,
      transaction_from,
      transaction_to
    FROM base.decoded_logs 
    WHERE (
      (parameters['from'] = '${address.toLowerCase()}' OR parameters['to'] = '${address.toLowerCase()}')
      OR (transaction_from = '${address.toLowerCase()}' OR transaction_to = '${address.toLowerCase()}')
    )
      AND event_name IN ('Transfer', 'Deposit', 'Withdraw', 'Mint', 'Burn', 'Swap')
      AND action = 1
    ORDER BY block_timestamp DESC
    LIMIT 100
  `;

  try {
    return await queryHistoricalData(sqlQuery);
  } catch (error) {
    console.error('Error fetching DeFi positions:', error);
    return [];
  }
}

/**
 * Calculate portfolio metrics from CDP data
 */
export function calculatePortfolioMetrics(snapshot: PortfolioSnapshot, previousSnapshot?: PortfolioSnapshot) {
  const { balances, totalUsdValue } = snapshot;
  
  // Calculate allocations
  const allocations = balances
    .filter(balance => (balance.usdValue || 0) > 0)
    .map(balance => ({
      symbol: balance.token.symbol || 'Unknown',
      allocation_pct: totalUsdValue > 0 ? ((balance.usdValue || 0) / totalUsdValue) * 100 : 0,
      usd_value: balance.usdValue || 0,
    }))
    .sort((a, b) => b.usd_value - a.usd_value);

  // Calculate stablecoin allocation
  const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX'];
  const stablecoinValue = balances
    .filter(balance => stablecoins.includes(balance.token.symbol || ''))
    .reduce((sum, balance) => sum + (balance.usdValue || 0), 0);
  
  const stablecoinAllocationPct = totalUsdValue > 0 ? (stablecoinValue / totalUsdValue) * 100 : 0;

  // Calculate daily PnL if previous snapshot available
  let dailyPnlPct = 0;
  if (previousSnapshot && previousSnapshot.totalUsdValue > 0) {
    dailyPnlPct = ((totalUsdValue - previousSnapshot.totalUsdValue) / previousSnapshot.totalUsdValue) * 100;
  }

  return {
    total_usd_value: totalUsdValue,
    daily_pnl_pct: dailyPnlPct,
    stablecoin_allocation_pct: stablecoinAllocationPct,
    largest_position_pct: allocations[0]?.allocation_pct || 0,
    asset_allocations: allocations.slice(0, 10), // Top 10 positions
  };
}
