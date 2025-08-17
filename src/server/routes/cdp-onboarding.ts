import express from 'express';
import { cdp, EVM_NETWORK } from '../../lib/cdp';
import { supabase } from '../../lib/supabase';
import { requireAuth, getUserId } from '../../lib/session';

export const cdpOnboardingRoutes = express.Router();

// Provision a new server account for the user
cdpOnboardingRoutes.post('/provision', async (req, res) => {
  try {
    const userId = await requireAuth(req);

    // Ensure user exists in users table (auto-create from Supabase auth)
    const { data: userData, error: userError } = await supabase.auth.getUser(req.headers.authorization?.substring(7) || '');
    if (userData.user) {
      await supabase
        .from('users')
        .upsert({
          id: userData.user.id,
          email: userData.user.email || '',
          password_hash: 'supabase_managed' // Placeholder since Supabase handles auth
        }, {
          onConflict: 'id'
        });
    }

    // Check if user already has a server account
    const { data: existing, error: existingError } = await supabase
      .from('user_accounts')
      .select('address')
      .eq('user_id', userId)
      .eq('type', 'server')
      .single();

    if (existing && !existingError) {
      return res.json({ address: existing.address });
    }

    // Create a new EVM account using CDP SDK
    const account = await cdp.evm.createAccount({ name: `account-${Date.now()}` });
    const addressString = account.address.toLowerCase();

    // Store in database
    const { error: insertError } = await supabase
      .from('user_accounts')
      .upsert({
        user_id: userId,
        type: 'server',
        cdp_account_id: null,
        address: addressString,
        chain: 'base',
        status: 'provisioned'
      }, {
        onConflict: 'user_id,type'
      });

    if (insertError) {
      console.error('Error storing account:', insertError);
      throw insertError;
    }

    res.json({ address: addressString });
  } catch (error) {
    console.error('Error provisioning account:', error);
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return res.status(401).json({ error: 'Authentication required - please log in' });
    }
    res.status(500).json({ error: 'Failed to provision account' });
  }
});

// Get current user's server account
cdpOnboardingRoutes.get('/me', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { data, error } = await supabase
      .from('user_accounts')
      .select('address, status')
      .eq('user_id', userId)
      .eq('type', 'server')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ exists: false });
    }

    res.json({ exists: true, server: data });
  } catch (error) {
    console.error('Error fetching user account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Check funding status for an account address
cdpOnboardingRoutes.get('/:address/funding-status', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const MIN_WEI = 10n ** 15n; // ~0.001 ETH

    // Get balance using CDP SDK
    const result = await cdp.evm.listTokenBalances({ address: address as `0x${string}`, network: EVM_NETWORK });
    const native = result.balances.find((b: any) => b.token?.standard === "NATIVE");
    const nativeWei = native ? BigInt(native.amount?.amount ?? "0") : BigInt(0);
    const funded = nativeWei >= MIN_WEI;
    
    // Convert BigInt to string for JSON serialization
    const balance = nativeWei.toString();

    // Update account status
    if (funded) {
      const { error: updateError } = await supabase
        .from('user_accounts')
        .update({
          status: 'active',
          first_funded_at: new Date().toISOString()
        })
        .eq('address', address)
        .is('first_funded_at', null);

      if (updateError) {
        console.error('Error updating funded account:', updateError);
      }

      // Also update if first_funded_at is already set
      await supabase
        .from('user_accounts')
        .update({ status: 'active' })
        .eq('address', address);
    } else {
      const { data: currentAccount } = await supabase
        .from('user_accounts')
        .select('status')
        .eq('address', address)
        .single();

      if (currentAccount?.status === 'provisioned') {
        await supabase
          .from('user_accounts')
          .update({ status: 'funding' })
          .eq('address', address);
      }
    }

    // Store balance snapshot
    const balanceData = {
      balances: result.balances.map((balance: any) => ({
        asset: balance.token?.symbol || 'UNKNOWN',
        amount: (balance.amount?.amount || '0').toString(), // Ensure string conversion
        decimals: balance.amount?.decimals || 18
      }))
    };

    const { error: balanceError } = await supabase
      .from('account_balances')
      .insert({
        address: address,
        payload: balanceData
      });

    if (balanceError) {
      console.error('Error storing balance:', balanceError);
    }

    res.json({ funded });
  } catch (error) {
    console.error('Error checking funding status:', error);
    res.status(500).json({ error: 'Failed to check funding status' });
  }
});

// Dashboard data aggregation
cdpOnboardingRoutes.get('/dashboard', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Get user's active account
    const { data: account, error: accountError } = await supabase
      .from('user_accounts')
      .select('address')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (accountError || !account) {
      return res.json({ ready: false });
    }

    const address = account.address;

    // Get latest balance snapshot
    const { data: balanceData, error: balanceError } = await supabase
      .from('account_balances')
      .select('payload')
      .eq('address', address)
      .order('as_of', { ascending: false })
      .limit(1)
      .single();

    const payload = balanceData?.payload ?? { balances: [] };
    const { totalUsd, tokens } = summarizeBalances(payload);

    res.json({ ready: true, address, totalUsd, tokens });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

function summarizeBalances(payload: any) {
  const tokens = (payload.balances ?? []).map((b: any) => ({
    symbol: b.asset ?? 'UNKNOWN',
    amount: b.amount ?? '0',
    decimals: b.decimals ?? null,
  }));
  
  // TODO: Add USD pricing calculation
  const totalUsd = 0;
  
  return { totalUsd, tokens };
}
