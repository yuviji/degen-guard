import { useState, useEffect } from 'react';

interface Transaction {
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

interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTransactions(walletAddress?: string, limit: number = 50): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async (refresh: boolean = false) => {
    if (!walletAddress) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(refresh && { refresh: 'true' })
      });

      const response = await fetch(`/api/wallets/${walletAddress}/transactions?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('Wallet not found');
        } else {
          throw new Error('Failed to fetch transactions');
        }
      }

      const data = await response.json();
      
      // Transform the data to ensure proper date parsing
      const formattedTransactions = data.map((tx: any) => ({
        ...tx,
        timestamp: new Date(tx.timestamp)
      }));

      setTransactions(formattedTransactions);
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
  }, [walletAddress, limit]);

  return {
    transactions,
    loading,
    error,
    refetch
  };
}
