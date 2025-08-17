import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface Account {
  id: string;
  user_id: string;
  type: string;
  cdp_account_id?: string;
  address: string;
  chain: string;
  status: string;
  first_funded_at?: string;
  created_at: string;
}

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
      const response = await fetch('/api/accounts', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status}:`, errorText);
        
        if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('Accounts endpoint not found - check server routing');
        } else {
          throw new Error(`Failed to fetch accounts: ${response.status} ${errorText}`);
        }
      }

      const data = await response.json();
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
