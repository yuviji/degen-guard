import express from 'express';
import pool from '../../database/connection';
import { PortfolioMetrics } from '@/shared/types';

export const portfolioRoutes = express.Router();

// Get portfolio overview for a user
portfolioRoutes.get('/overview', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get total portfolio value
    const totalValueResult = await pool.query(`
      SELECT 
        COALESCE(SUM(a.usd_value), 0) as total_usd_value,
        COUNT(DISTINCT a.token_symbol) as token_count
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '1 hour'
    `, [userId]);

    // Get stablecoin allocation
    const stablecoinResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN a.token_symbol IN ('USDC', 'USDT', 'DAI', 'BUSD', 'FRAX') THEN a.usd_value ELSE 0 END), 0) as stablecoin_value,
        COALESCE(SUM(a.usd_value), 0) as total_value
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '1 hour'
    `, [userId]);

    // Get asset allocations
    const allocationsResult = await pool.query(`
      SELECT 
        a.token_symbol as symbol,
        SUM(a.usd_value) as usd_value,
        CASE 
          WHEN SUM(SUM(a.usd_value)) OVER() > 0 THEN 
            (SUM(a.usd_value) / SUM(SUM(a.usd_value)) OVER()) * 100
          ELSE 0 
        END as allocation_pct
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '1 hour'
        AND a.usd_value > 0
      GROUP BY a.token_symbol
      ORDER BY usd_value DESC
      LIMIT 10
    `, [userId]);

    // Calculate daily PnL (simplified - would need historical data)
    const dailyPnlResult = await pool.query(`
      SELECT 
        COALESCE(
          (SUM(current_val.usd_value) - SUM(prev_val.usd_value)) / NULLIF(SUM(prev_val.usd_value), 0) * 100,
          0
        ) as daily_pnl_pct
      FROM wallets w
      LEFT JOIN asset_snapshots current_val ON w.id = current_val.wallet_id 
        AND current_val.timestamp >= NOW() - INTERVAL '1 hour'
      LEFT JOIN asset_snapshots prev_val ON w.id = prev_val.wallet_id 
        AND prev_val.timestamp >= NOW() - INTERVAL '25 hours'
        AND prev_val.timestamp < NOW() - INTERVAL '23 hours'
        AND prev_val.token_symbol = current_val.token_symbol
      WHERE w.user_id = $1
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
    const userId = req.query.userId as string;
    const days = parseInt(req.query.days as string) || 7;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', a.timestamp) as timestamp,
        SUM(a.usd_value) as total_value
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE_TRUNC('hour', a.timestamp)
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
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(`
      SELECT 
        e.*,
        w.address as wallet_address,
        w.chain,
        w.label as wallet_label
      FROM wallets w
      JOIN chain_events e ON w.id = e.wallet_id
      WHERE w.user_id = $1
      ORDER BY e.timestamp DESC
      LIMIT $2
    `, [userId, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching portfolio transactions:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio transactions' });
  }
});
