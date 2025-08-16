import express from 'express';
import { cdp, EVM_NETWORK } from '../../lib/cdp';
import { db } from '../../lib/db';
import { requireAuth, getUserId } from '../../lib/session';

export const cdpOnboardingRoutes = express.Router();

// Provision a new server wallet for the user
cdpOnboardingRoutes.post('/provision', async (req, res) => {
  try {
    const userId = requireAuth(req);

    // Check if user already has a server wallet
    const existing = await db.query(
      `SELECT address FROM user_wallets WHERE user_id = $1 AND type = 'server'`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.json({ address: existing.rows[0].address });
    }

    // Create a new EVM account using CDP SDK
    const account = await cdp.evm.createAccount({ name: `wallet-${Date.now()}` });
    const addressString = account.address.toLowerCase();

    // Store in database
    await db.query(
      `INSERT INTO user_wallets(user_id, type, cdp_wallet_id, address, chain, status)
       VALUES ($1, 'server', $2, $3, $4, 'provisioned')
       ON CONFLICT (user_id, type) DO NOTHING`,
      [userId, null, addressString, 'base']
    );

    res.json({ address: addressString });
  } catch (error) {
    console.error('Error provisioning wallet:', error);
    res.status(500).json({ error: 'Failed to provision wallet' });
  }
});

// Get current user's server wallet
cdpOnboardingRoutes.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { rows } = await db.query(
      `SELECT address, status
       FROM user_wallets
       WHERE user_id = $1 AND type = 'server'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.json({ exists: false });
    }

    res.json({ exists: true, server: rows[0] });
  } catch (error) {
    console.error('Error fetching user wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Check funding status for a wallet address
cdpOnboardingRoutes.get('/:address/funding-status', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const MIN_WEI = 10n ** 15n; // ~0.001 ETH

    // Get balance using CDP SDK
    const result = await cdp.evm.listTokenBalances({ address: address as `0x${string}`, network: EVM_NETWORK });
    const native = result.balances.find((b: any) => b.token?.standard === "NATIVE");
    const nativeWei = native ? BigInt(native.amount?.amount ?? "0") : BigInt(0);
    const funded = nativeWei >= MIN_WEI;

    // Update wallet status
    if (funded) {
      await db.query(
        `UPDATE user_wallets
         SET status = 'active', first_funded_at = COALESCE(first_funded_at, NOW())
         WHERE address = $1`,
        [address]
      );
    } else {
      await db.query(
        `UPDATE user_wallets
         SET status = CASE WHEN status = 'provisioned' THEN 'funding' ELSE status END
         WHERE address = $1`,
        [address]
      );
    }

    // Store balance snapshot
    const balanceData = {
      balances: result.balances.map((balance: any) => ({
        asset: balance.token?.symbol || 'UNKNOWN',
        amount: balance.amount?.amount || '0',
        decimals: balance.amount?.decimals || 18
      }))
    };

    await db.query(
      `INSERT INTO wallet_balances(address, payload) VALUES ($1, $2)`,
      [address, JSON.stringify(balanceData)]
    );

    res.json({ funded });
  } catch (error) {
    console.error('Error checking funding status:', error);
    res.status(500).json({ error: 'Failed to check funding status' });
  }
});

// Dashboard data aggregation
cdpOnboardingRoutes.get('/dashboard', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Get user's active wallet
    const { rows: walletRows } = await db.query(
      `SELECT address FROM user_wallets WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (!walletRows.length) {
      return res.json({ ready: false });
    }

    const address = walletRows[0].address;

    // Get latest balance snapshot
    const { rows: balanceRows } = await db.query(
      `SELECT payload FROM wallet_balances WHERE address = $1 ORDER BY as_of DESC LIMIT 1`,
      [address]
    );

    const payload = balanceRows[0]?.payload ?? { balances: [] };
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
