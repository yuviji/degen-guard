import { CDPBalance, CDPTransaction, CDPPrice } from '@/shared/types';
import { cdp } from '../../lib/cdp';
import dotenv from 'dotenv';

dotenv.config();

class CDPService {
  constructor() {
    // CDP client is initialized in lib/cdp.ts
  }

  async getWalletBalances(address: string, networkId: string): Promise<CDPBalance[]> {
    try {
      // Use CDP JSON-RPC API to get wallet balances
      const rpcUrl = `https://api.developer.coinbase.com/rpc/v1/${networkId}/${process.env.CDP_API_KEY_ID}`;
      
      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "cdp_listAddressBalances",
        params: [{
          address: address,
          pageSize: 100
        }]
      };

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CDP_API_KEY_SECRET}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`CDP API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`CDP API error: ${data.error.message || 'Unknown error'}`);
      }

      const balances = data.result?.data || [];
      
      return balances.map((balance: any): CDPBalance => ({
        amount: balance.amount || '0',
        currency: {
          code: balance.asset?.symbol || 'ETH',
          name: balance.asset?.name || 'Ethereum',
          address: balance.asset?.contract_address || ''
        },
        usd_value: {
          amount: balance.usd_value || '0',
          currency: 'USD'
        }
      }));
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
      throw new Error('Failed to fetch wallet balances');
    }
  }

  async getWalletTransactions(address: string, networkId: string, limit: number = 100): Promise<CDPTransaction[]> {
    try {
      // Use CDP JSON-RPC API to get wallet transactions
      const rpcUrl = `https://api.developer.coinbase.com/rpc/v1/${networkId}/${process.env.CDP_API_KEY_ID}`;
      
      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "cdp_listAddressTransactions",
        params: [{
          address: address,
          pageSize: limit,
          pageToken: ""
        }]
      };

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CDP_API_KEY_SECRET}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`CDP API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`CDP API error: ${data.error.message || 'Unknown error'}`);
      }

      const transactions = data.result?.data || [];
      
      return transactions.map((tx: any): CDPTransaction => ({
        id: tx.transaction_hash || tx.hash || `${address}-${Date.now()}`,
        hash: tx.transaction_hash || tx.hash || '',
        block_height: parseInt(tx.block_number || '0'),
        block_timestamp: tx.block_timestamp || new Date().toISOString(),
        type: tx.type || 'transfer',
        from_address: tx.from_address || '',
        to_address: tx.to_address || '',
        value: {
          amount: tx.value || tx.amount || '0',
          currency: tx.symbol || tx.token_symbol || 'ETH'
        }
      }));
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      throw new Error('Failed to fetch wallet transactions');
    }
  }

  async getTokenPrice(tokenSymbol: string): Promise<CDPPrice> {
    try {
      // Use Coinbase public API for price data
      const response = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${tokenSymbol}`);
      
      if (!response.ok) {
        throw new Error(`Price API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        amount: data.data?.rates?.USD || '0',
        currency: 'USD',
        base: tokenSymbol
      };
    } catch (error) {
      console.error('Error fetching token price:', error);
      return {
        amount: '0',
        currency: 'USD',
        base: tokenSymbol
      };
    }
  }

  async getMultipleTokenPrices(tokenSymbols: string[]): Promise<Record<string, CDPPrice>> {
    const prices: Record<string, CDPPrice> = {};
    
    await Promise.all(
      tokenSymbols.map(async (symbol) => {
        try {
          prices[symbol] = await this.getTokenPrice(symbol);
        } catch (error) {
          console.error(`Error fetching price for ${symbol}:`, error);
          prices[symbol] = {
            amount: '0',
            currency: 'USD',
            base: symbol
          };
        }
      })
    );
    
    return prices;
  }

  async validateAddress(address: string, networkId: string): Promise<boolean> {
    try {
      // Validate Ethereum address format
      const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(address);
      
      if (!isValidFormat) {
        return false;
      }

      // Additional validation: check if address has any activity on the network
      try {
        const rpcUrl = `https://api.developer.coinbase.com/rpc/v1/${networkId}/${process.env.CDP_API_KEY_ID}`;
        
        const requestBody = {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [address, "latest"]
        };

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CDP_API_KEY_SECRET}`
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          // If we can get a balance (even 0), the address is valid on this network
          return !data.error;
        }
      } catch (networkError) {
        // If network check fails, fall back to format validation
        console.warn('Network validation failed, using format validation only:', networkError);
      }
      
      return isValidFormat;
    } catch (error) {
      console.error('Error validating address:', error);
      return false;
    }
  }
}

export default new CDPService();
