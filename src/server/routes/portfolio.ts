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
import { supabase } from '../../lib/supabase';
import { transactionHistoryService } from '../services/transaction-history';

export const portfolioRoutes = express.Router();

// Get portfolio overview for a user
portfolioRoutes.get('/overview', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's server wallet address
    const serverWallet = await getServerWallet(userId);
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

    res.json({
      ...metrics,
      serviceStatus: 'operational', // Portfolio overview uses token balances which work even during CDP SQL outages
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching portfolio overview:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio overview' });
  }
});

// Get portfolio history
portfolioRoutes.get('/history', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const days = parseInt(req.query.days as string) || 7;

    // Get user's server wallet address
    const serverWallet = await getServerWallet(userId);
    if (!serverWallet) {
      return res.status(404).json({ error: 'No server wallet found for user' });
    }

    // Get historical balance data using CDP SQL API
    const historicalData = await getHistoricalBalances(
      serverWallet.address, 
      days, 
      'base'
    );

    // Check if we got fallback data due to service outage
    const isServiceDown = historicalData.length === 1 && 
                          historicalData[0].totalValue === 0 && 
                          new Date().getTime() - historicalData[0].timestamp.getTime() < 25 * 60 * 60 * 1000;

    res.json({
      data: historicalData,
      serviceStatus: isServiceDown ? 'degraded' : 'operational',
      message: isServiceDown ? 'Historical data temporarily unavailable due to CDP service outage' : null
    });
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

// Get recent transactions across all wallets
portfolioRoutes.get('/transactions', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const limit = parseInt(req.query.limit as string) || 50;

    // Get all of the user's wallet addresses from SQL
    const { data: userAccounts, error: accountsError } = await supabase
      .from('user_accounts')
      .select('address')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching user accounts:', accountsError);
      return res.status(500).json({ error: 'Failed to fetch user accounts' });
    }

    if (!userAccounts || userAccounts.length === 0) {
      return res.json([]); // No accounts = no transactions
    }

    // Get transactions from all wallet addresses using our SQL-based service
    const allTransactions = [];
    
    for (const account of userAccounts) {
      try {
        const transactions = await transactionHistoryService.getTransactions(
          account.address, 
          limit,
          false // Don't refresh from CDP for aggregated view
        );
        allTransactions.push(...transactions);
      } catch (error) {
        console.error(`Error fetching transactions for ${account.address}:`, error);
        // Continue with other addresses even if one fails
      }
    }

    // Sort all transactions by timestamp (most recent first) and apply limit
    const sortedTransactions = allTransactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    // Check if we have any transactions (if none, might be due to CDP service issues)
    const hasTransactions = sortedTransactions.length > 0;

    res.json({
      transactions: sortedTransactions,
      serviceStatus: hasTransactions ? 'operational' : 'degraded',
      message: !hasTransactions ? 'Transaction history may be incomplete due to external service issues' : null,
      count: sortedTransactions.length
    });
  } catch (error) {
    console.error('Error fetching portfolio transactions:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio transactions' });
  }
});

// Get overall service status
portfolioRoutes.get('/status', async (req, res) => {
  try {
    // Test CDP data service with a simple query
    const testQuery = `
      SELECT COUNT(*) as test_count 
      FROM base.transactions 
      LIMIT 1
    `;
    
    const { queryHistoricalData } = await import('../../lib/cdp-data');
    
    try {
      await queryHistoricalData(testQuery);
      res.json({
        cdpData: 'operational',
        overall: 'operational',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const isServiceDown = error instanceof Error && 
                           error.message.includes('CDP API service is currently unavailable');
      
      res.json({
        cdpData: isServiceDown ? 'outage' : 'degraded',
        overall: isServiceDown ? 'degraded' : 'operational',
        timestamp: new Date().toISOString(),
        message: isServiceDown ? 'CDP historical data service is experiencing an outage' : 'Some services may be degraded'
      });
    }
  } catch (error) {
    console.error('Error checking service status:', error);
    res.status(500).json({ 
      error: 'Failed to check service status',
      overall: 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});
