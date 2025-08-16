import express from 'express';
import pool from '../../database/connection';
import { PortfolioMetrics } from '@/shared/types';
import { getUserId } from '../../lib/session';

export const portfolioRoutes = express.Router();

// Get portfolio overview for a user
portfolioRoutes.get('/overview', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get total portfolio value from latest account balance
    const totalValueResult = await pool.query(`
      SELECT 
        COALESCE((ab.payload->>'total_usd_value')::DECIMAL, 0) as total_usd_value,
        COALESCE(jsonb_array_length(ab.payload->'balances'), 0) as token_count
      FROM user_accounts ua
      JOIN LATERAL (
        SELECT payload 
        FROM account_balances 
        WHERE address = ua.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) ab ON true
      WHERE ua.user_id = $1 AND ua.status = 'active'
    `, [userId]);

    // Get stablecoin allocation from account balance payload
    const stablecoinResult = await pool.query(`
      SELECT 
        COALESCE(
          (SELECT SUM((balance->>'usd_value')::DECIMAL)
           FROM jsonb_array_elements(ab.payload->'balances') AS balance
           WHERE balance->>'symbol' IN ('USDC', 'USDT', 'DAI', 'BUSD', 'FRAX')), 0
        ) as stablecoin_value,
        COALESCE((ab.payload->>'total_usd_value')::DECIMAL, 0) as total_value
      FROM user_accounts ua
      JOIN LATERAL (
        SELECT payload 
        FROM account_balances 
        WHERE address = ua.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) ab ON true
      WHERE ua.user_id = $1 AND ua.status = 'active'
    `, [userId]);

    // Get asset allocations from account balance payload
    const allocationsResult = await pool.query(`
      SELECT 
        balance->>'symbol' as symbol,
        (balance->>'usd_value')::DECIMAL as usd_value,
        CASE 
          WHEN (ab.payload->>'total_usd_value')::DECIMAL > 0 THEN 
            ((balance->>'usd_value')::DECIMAL / (ab.payload->>'total_usd_value')::DECIMAL) * 100
          ELSE 0 
        END as allocation_pct
      FROM user_accounts ua
      JOIN LATERAL (
        SELECT payload 
        FROM account_balances 
        WHERE address = ua.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) ab ON true,
      jsonb_array_elements(ab.payload->'balances') AS balance
      WHERE ua.user_id = $1 AND ua.status = 'active'
        AND (balance->>'usd_value')::DECIMAL > 0
      ORDER BY (balance->>'usd_value')::DECIMAL DESC
      LIMIT 10
    `, [userId]);

    // Calculate daily PnL from account balance history
    const dailyPnlResult = await pool.query(`
      SELECT 
        COALESCE(
          CASE 
            WHEN prev_balance.total_value > 0 THEN
              ((current_balance.total_value - prev_balance.total_value) / prev_balance.total_value) * 100
            ELSE 0
          END,
          0
        ) as daily_pnl_pct
      FROM user_accounts ua
      LEFT JOIN LATERAL (
        SELECT (payload->>'total_usd_value')::DECIMAL as total_value
        FROM account_balances 
        WHERE address = ua.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) current_balance ON true
      LEFT JOIN LATERAL (
        SELECT (payload->>'total_usd_value')::DECIMAL as total_value
        FROM account_balances 
        WHERE address = ua.address 
          AND as_of <= NOW() - INTERVAL '24 hours'
        ORDER BY as_of DESC 
        LIMIT 1
      ) prev_balance ON true
      WHERE ua.user_id = $1 AND ua.status = 'active'
    `, [userId]);

    const totalValue = parseFloat(totalValueResult.rows[0]?.total_usd_value || '0');
    const stablecoinValue = parseFloat(stablecoinResult.rows[0]?.stablecoin_value || '0');
    const stablecoinAllocationPct = totalValue > 0 ? (stablecoinValue / totalValue) * 100 : 0;
    const largestPositionPct = allocationsResult.rows[0]?.allocation_pct || 0;

    const metrics: PortfolioMetrics = {
      total_usd_value: totalValue,
      daily_pnl_pct: parseFloat(dailyPnlResult.rows[0]?.daily_pnl_pct || '0'),
      stablecoin_allocation_pct: stablecoinAllocationPct,
      largest_position_pct: parseFloat(largestPositionPct),
      asset_allocations: allocationsResult.rows.map((row: any) => ({
        symbol: row.symbol,
        allocation_pct: parseFloat(row.allocation_pct),
        usd_value: parseFloat(row.usd_value)
      }))
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching portfolio overview:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio overview' });
  }
});

// Get portfolio history
portfolioRoutes.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const days = parseInt(req.query.days as string) || 7;

    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', ab.as_of) as timestamp,
        (ab.payload->>'total_usd_value')::DECIMAL as total_value
      FROM user_accounts ua
      JOIN account_balances ab ON ua.address = ab.address
      WHERE ua.user_id = $1 AND ua.status = 'active'
        AND ab.as_of >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

// Get recent transactions across all wallets
portfolioRoutes.get('/transactions', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await pool.query(`
      SELECT 
        ae.*,
        ua.address as account_address,
        ua.chain
      FROM user_accounts ua
      JOIN account_events ae ON ua.address = ae.address
      WHERE ua.user_id = $1 AND ua.status = 'active'
      ORDER BY ae.occurred_at DESC
      LIMIT $2
    `, [userId, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching portfolio transactions:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio transactions' });
  }
});
