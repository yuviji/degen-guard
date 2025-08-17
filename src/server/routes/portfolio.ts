import express from 'express';
import { PortfolioMetrics } from '@/shared/types';
import { getUserId } from '../../lib/session';
import { getServerWallet } from '../../lib/cdp';
import { 
  getPortfolioSnapshot, 
  calculatePortfolioMetrics, 
  getHistoricalBalances,
  getTransactionHistory,
  SUPPORTED_NETWORKS 
} from '../../lib/cdp-data';

export const portfolioRoutes = express.Router();

// Get portfolio overview for a user
portfolioRoutes.get('/overview', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's server wallet address
    const serverWallet = await getServerWallet(Number(userId));
    if (!serverWallet) {
      return res.status(404).json({ error: 'No server wallet found for user' });
    }

    // Get current portfolio snapshot using CDP Data API
    const currentSnapshot = await getPortfolioSnapshot(
      serverWallet.address as `0x${string}`, 
      SUPPORTED_NETWORKS.BASE_MAINNET
    );

    // Get historical snapshot for daily PnL calculation (24 hours ago)
    // For now, we'll use a placeholder - in production you'd store snapshots or use historical data
    const previousSnapshot = null; // TODO: Implement historical snapshot storage

    // Calculate portfolio metrics using CDP data
    const metrics = calculatePortfolioMetrics(currentSnapshot, previousSnapshot);

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

    // Get user's server wallet address
    const serverWallet = await getServerWallet(Number(userId));
    if (!serverWallet) {
      return res.status(404).json({ error: 'No server wallet found for user' });
    }

    // Get historical balance data using CDP SQL API
    const historicalData = await getHistoricalBalances(
      serverWallet.address, 
      days, 
      'base'
    );

    res.json(historicalData);
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

    // Get user's server wallet address
    const serverWallet = await getServerWallet(Number(userId));
    if (!serverWallet) {
      return res.status(404).json({ error: 'No server wallet found for user' });
    }

    // Get transaction history using CDP SQL API
    const transactions = await getTransactionHistory(
      serverWallet.address,
      limit,
      'base'
    );

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching portfolio transactions:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio transactions' });
  }
});
