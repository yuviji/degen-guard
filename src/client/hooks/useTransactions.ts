import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Transaction {
  id: string;
  accountId: string;
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
  accountAddress: string;
  chain: "ethereum" | "polygon" | "arbitrum" | "optimism" | "base";
  accountLabel: string;
  status: "confirmed" | "pending" | "failed";
}

interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTransactions(accountAddress?: string, limit: number = 50): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async (refresh: boolean = false) => {
    if (!accountAddress) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Authentication required');
      }

      // Build the API URL
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(refresh && { refresh: 'true' })
      });
      const url = `${API_BASE_URL}/api/accounts/${accountAddress}/transactions?${params}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('Account not found');
        } else {
          throw new Error(`Failed to fetch transactions: ${response.status}`);
        }
      }

      const data = await response.json();
      
      // Handle new response format with service status
      const responseData = data.transactions || data; // Support both new and legacy formats
      
      // Transform the data to ensure proper date parsing
      const formattedTransactions = responseData.map((tx: any) => ({
        ...tx,
        timestamp: new Date(tx.timestamp)
      }));

      setTransactions(formattedTransactions);
      
      // Log service status if available
      if (data.serviceStatus && data.serviceStatus !== 'operational') {
        console.warn('Transaction service status:', data.serviceStatus, data.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await fetchTransactions(true);
  };

  useEffect(() => {
    fetchTransactions();
  }, [accountAddress, limit]);

  return {
    transactions,
    loading,
    error,
    refetch
  };
}
