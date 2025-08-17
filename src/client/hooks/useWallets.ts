import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { accountsApi, Account } from '@/lib/api';



interface UseAccountsResult {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchAccounts = async () => {
    if (!session?.access_token) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await accountsApi.getAll();
      setAccounts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await fetchAccounts();
  };

  useEffect(() => {
    if (session) {
      fetchAccounts();
    }
  }, [session]);

  return {
    accounts,
    loading,
    error,
    refetch
  };
}

// Legacy alias for backward compatibility
export const useWallets = useAccounts;
