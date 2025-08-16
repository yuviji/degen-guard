import { useState, useEffect } from 'react';

interface Wallet {
  id: string;
  user_id: string;
  type: string;
  cdp_wallet_id?: string;
  address: string;
  chain: string;
  status: string;
  first_funded_at?: string;
  created_at: string;
}

interface UseWalletsResult {
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWallets(): UseWalletsResult {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wallets', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        } else {
          throw new Error('Failed to fetch wallets');
        }
      }

      const data = await response.json();
      setWallets(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await fetchWallets();
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  return {
    wallets,
    loading,
    error,
    refetch
  };
}
