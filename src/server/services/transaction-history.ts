import { cdp, EVM_NETWORK } from '../../lib/cdp';
import pool from '../../database/connection';

interface TransactionData {
  id: string;
  walletId: string;
  transactionHash: string;
  blockNumber: number;
  eventType: "transfer" | "swap" | "deposit" | "withdrawal";
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  amount: string;
  usdValue: string;
  gasUsed: string;
  gasFee: string;
  timestamp: Date;
  walletAddress: string;
  chain: "ethereum" | "polygon" | "arbitrum" | "optimism" | "base";
  walletLabel: string;
  status: "confirmed" | "pending" | "failed";
}

export class TransactionHistoryService {
  /**
   * Fetch transactions for a wallet address using CDP JSON-RPC API
   */
  async fetchTransactionsFromCDP(walletAddress: string, limit: number = 50): Promise<TransactionData[]> {
    try {
      console.log(`Fetching transactions for address ${walletAddress} (limit: ${limit})`);
      
      // Construct CDP JSON-RPC request
      const rpcUrl = `https://api.developer.coinbase.com/rpc/v1/${EVM_NETWORK}/${process.env.CDP_API_KEY_ID}`;
      
      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "cdp_listAddressTransactions",
        params: [{
          address: walletAddress,
          pageSize: limit,
          pageToken: "" // Start from beginning
        }]
      };

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const formattedTransactions: TransactionData[] = [];
      
      for (const tx of transactions) {
        try {
          const formattedTx = await this.formatCDPTransaction(tx, walletAddress);
          if (formattedTx) {
            formattedTransactions.push(formattedTx);
          }
        } catch (error) {
          console.error('Error formatting transaction:', error);
          // Continue processing other transactions
        }
      }
      
      console.log(`Successfully fetched ${formattedTransactions.length} transactions from CDP`);
      return formattedTransactions;
    } catch (error) {
      console.error('Error fetching transactions from CDP:', error);
      throw new Error(`Failed to fetch transactions from CDP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format CDP transaction data to match our interface
   */
  private async formatCDPTransaction(cdpTx: any, walletAddress: string): Promise<TransactionData | null> {
    try {
      // Extract transaction details from CDP response
      const txHash = cdpTx.transaction_hash || cdpTx.hash || cdpTx.tx_hash;
      const blockNumber = parseInt(cdpTx.block_number || cdpTx.blockNumber || '0');
      
      // Parse timestamp - CDP returns ISO string or Unix timestamp
      let timestamp: Date;
      if (cdpTx.block_timestamp) {
        timestamp = new Date(cdpTx.block_timestamp);
      } else if (cdpTx.timestamp) {
        // Handle Unix timestamp (seconds or milliseconds)
        const ts = parseInt(cdpTx.timestamp);
        timestamp = new Date(ts > 1e10 ? ts : ts * 1000);
      } else {
        timestamp = new Date();
      }
      
      // Determine transaction type based on CDP data
      let eventType: TransactionData['eventType'] = 'transfer';
      
      // Check method signature or transaction type
      const method = cdpTx.method || cdpTx.function_name || '';
      const txType = cdpTx.type || cdpTx.transaction_type || '';
      
      if (method.toLowerCase().includes('swap') || txType.toLowerCase().includes('swap')) {
        eventType = 'swap';
      } else if (method.toLowerCase().includes('deposit') || txType.toLowerCase().includes('deposit')) {
        eventType = 'deposit';
      } else if (method.toLowerCase().includes('withdraw') || txType.toLowerCase().includes('withdraw')) {
        eventType = 'withdrawal';
      } else if (cdpTx.from_address?.toLowerCase() === walletAddress.toLowerCase()) {
        eventType = 'withdrawal'; // Outgoing transfer
      } else if (cdpTx.to_address?.toLowerCase() === walletAddress.toLowerCase()) {
        eventType = 'deposit'; // Incoming transfer
      }

      // Extract addresses
      const fromAddress = cdpTx.from_address || cdpTx.from || cdpTx.sender || '';
      const toAddress = cdpTx.to_address || cdpTx.to || cdpTx.recipient || '';
      
      // Extract token information - handle both native and token transfers
      const tokenAddress = cdpTx.contract_address || cdpTx.token_address || '';
      let tokenSymbol = cdpTx.symbol || cdpTx.token_symbol || 'ETH';
      let tokenName = cdpTx.name || cdpTx.token_name || 'Ethereum';
      
      // For Base network, default to ETH if no token info
      if (EVM_NETWORK === 'base' && !tokenAddress) {
        tokenSymbol = 'ETH';
        tokenName = 'Ethereum';
      }
      
      // Extract amounts - handle different value formats
      let amount = '0';
      if (cdpTx.value) {
        amount = cdpTx.value.toString();
      } else if (cdpTx.amount) {
        amount = cdpTx.amount.toString();
      } else if (cdpTx.raw_value) {
        amount = cdpTx.raw_value.toString();
      }
      
      // Convert from wei to ether for display (if it's a large number, assume it's in wei)
      const numAmount = parseFloat(amount);
      if (numAmount > 1e15 && !tokenAddress) { // Likely wei amount for native token
        amount = (numAmount / 1e18).toString();
      }
      
      // Extract USD value
      const usdValue = cdpTx.usd_value || cdpTx.value_usd || '0';
      
      // Extract gas information
      const gasUsed = cdpTx.gas_used || cdpTx.gasUsed || '0';
      let gasFee = cdpTx.gas_fee || cdpTx.transaction_fee || cdpTx.fee || '0';
      
      // Calculate gas fee if not provided but gas info is available
      if (!gasFee && cdpTx.gas_price && cdpTx.gas_used) {
        const gasPrice = parseFloat(cdpTx.gas_price);
        const gasUsedNum = parseFloat(cdpTx.gas_used);
        gasFee = ((gasPrice * gasUsedNum) / 1e18).toString(); // Convert from wei to ETH
      }
      
      // Determine chain - default to the current EVM_NETWORK
      let chain: TransactionData['chain'] = 'base';
      if (cdpTx.network || cdpTx.chain) {
        const networkStr = (cdpTx.network || cdpTx.chain).toLowerCase();
        if (networkStr.includes('ethereum')) chain = 'ethereum';
        else if (networkStr.includes('polygon')) chain = 'polygon';
        else if (networkStr.includes('arbitrum')) chain = 'arbitrum';
        else if (networkStr.includes('optimism')) chain = 'optimism';
        else if (networkStr.includes('base')) chain = 'base';
      }

      // Determine status
      let status: TransactionData['status'] = 'confirmed';
      if (cdpTx.status) {
        const statusStr = cdpTx.status.toLowerCase();
        if (statusStr.includes('pending')) status = 'pending';
        else if (statusStr.includes('failed') || statusStr.includes('error')) status = 'failed';
      }

      const formattedTransaction: TransactionData = {
        id: txHash || `${walletAddress}-${blockNumber}-${Date.now()}`,
        walletId: walletAddress,
        transactionHash: txHash || '',
        blockNumber,
        eventType,
        fromAddress,
        toAddress,
        tokenAddress,
        tokenSymbol,
        tokenName,
        amount,
        usdValue: usdValue.toString(),
        gasUsed: gasUsed.toString(),
        gasFee: gasFee.toString(),
        timestamp,
        walletAddress,
        chain,
        walletLabel: 'CDP Wallet',
        status
      };

      return formattedTransaction;
    } catch (error) {
      console.error('Error formatting CDP transaction:', error, 'Raw transaction:', cdpTx);
      return null;
    }
  }

  /**
   * Store transactions in the database
   */
  async storeTransactions(transactions: TransactionData[]): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const tx of transactions) {
        // Insert or update wallet_events table
        await client.query(`
          INSERT INTO wallet_events (
            address, occurred_at, kind, tx_hash, chain, details
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tx_hash) DO UPDATE SET
            details = EXCLUDED.details,
            occurred_at = EXCLUDED.occurred_at
        `, [
          tx.walletAddress,
          tx.timestamp,
          this.mapEventTypeToKind(tx.eventType),
          tx.transactionHash,
          tx.chain,
          JSON.stringify({
            blockNumber: tx.blockNumber,
            eventType: tx.eventType,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            tokenAddress: tx.tokenAddress,
            tokenSymbol: tx.tokenSymbol,
            tokenName: tx.tokenName,
            amount: tx.amount,
            usdValue: tx.usdValue,
            gasUsed: tx.gasUsed,
            gasFee: tx.gasFee,
            status: tx.status
          })
        ]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error storing transactions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Map our event types to database kinds
   */
  private mapEventTypeToKind(eventType: TransactionData['eventType']): string {
    switch (eventType) {
      case 'transfer':
        return 'transfer_out'; // Default to transfer_out, could be refined
      case 'swap':
        return 'swap';
      case 'deposit':
        return 'transfer_in';
      case 'withdrawal':
        return 'transfer_out';
      default:
        return 'other';
    }
  }

  /**
   * Get transactions for a wallet address (from database with CDP fallback)
   */
  async getTransactions(walletAddress: string, limit: number = 50, refresh: boolean = false): Promise<TransactionData[]> {
    try {
      // If refresh is requested, fetch from CDP first
      if (refresh) {
        const cdpTransactions = await this.fetchTransactionsFromCDP(walletAddress, limit);
        if (cdpTransactions.length > 0) {
          await this.storeTransactions(cdpTransactions);
        }
      }

      // Get transactions from database
      const result = await pool.query(`
        SELECT 
          we.*,
          uw.user_id
        FROM wallet_events we
        JOIN user_wallets uw ON we.address = uw.address
        WHERE we.address = $1
        ORDER BY we.occurred_at DESC
        LIMIT $2
      `, [walletAddress, limit]);

      // Format database results to match our interface
      return result.rows.map(row => this.formatDatabaseTransaction(row));
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Format database transaction to match our interface
   */
  private formatDatabaseTransaction(dbTx: any): TransactionData {
    const details = dbTx.details || {};
    
    return {
      id: dbTx.tx_hash || dbTx.id.toString(),
      walletId: dbTx.address,
      transactionHash: dbTx.tx_hash || '',
      blockNumber: details.blockNumber || 0,
      eventType: details.eventType || this.mapKindToEventType(dbTx.kind),
      fromAddress: details.fromAddress || '',
      toAddress: details.toAddress || '',
      tokenAddress: details.tokenAddress || '',
      tokenSymbol: details.tokenSymbol || 'ETH',
      tokenName: details.tokenName || 'Ethereum',
      amount: details.amount || '0',
      usdValue: details.usdValue || '0',
      gasUsed: details.gasUsed || '0',
      gasFee: details.gasFee || '0',
      timestamp: new Date(dbTx.occurred_at),
      walletAddress: dbTx.address,
      chain: (dbTx.chain || 'base') as TransactionData['chain'],
      walletLabel: 'CDP Wallet',
      status: (details.status || 'confirmed') as TransactionData['status']
    };
  }

  /**
   * Map database kinds to our event types
   */
  private mapKindToEventType(kind: string): TransactionData['eventType'] {
    switch (kind) {
      case 'transfer_in':
        return 'deposit';
      case 'transfer_out':
        return 'withdrawal';
      case 'swap':
        return 'swap';
      default:
        return 'transfer';
    }
  }
}

export const transactionHistoryService = new TransactionHistoryService();
