import express from 'express';
import { fundingService } from '../services/funding';
import { requireAuth, getUserId } from '../../lib/session';
import { db } from '../../lib/db';

export const fundingRoutes = express.Router();

// Get available payment methods
fundingRoutes.get('/payment-methods', async (req, res) => {
  try {
    requireAuth(req);
    
    const paymentMethods = await fundingService.getPaymentMethods();
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Get funding quote
fundingRoutes.post('/quote', async (req, res) => {
  try {
    const userId = requireAuth(req);
    const { amount_usd, asset, network = 'base' } = req.body;

    if (!amount_usd || !asset) {
      return res.status(400).json({ error: 'amount_usd and asset are required' });
    }

    if (!['USDC', 'ETH'].includes(asset)) {
      return res.status(400).json({ error: 'asset must be USDC or ETH' });
    }

    // Get user's server account
    const accountResult = await db.query(
      `SELECT address FROM user_accounts WHERE user_id = $1 AND type = 'server' AND status IN ('provisioned', 'active')`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'No server account found' });
    }

    const address = accountResult.rows[0].address;
    const quote = await fundingService.getFundingQuote(address, parseFloat(amount_usd), asset, network);
    
    res.json(quote);
  } catch (error) {
    console.error('Error getting funding quote:', error);
    res.status(500).json({ error: 'Failed to get funding quote' });
  }
});

// Execute funding
fundingRoutes.post('/execute', async (req, res) => {
  try {
    const userId = requireAuth(req);
    const { quote_id, amount_usd, asset, network = 'base' } = req.body;

    if (!quote_id || !amount_usd || !asset) {
      return res.status(400).json({ error: 'quote_id, amount_usd, and asset are required' });
    }

    // Get user's server account
    const accountResult = await db.query(
      `SELECT address FROM user_accounts WHERE user_id = $1 AND type = 'server' AND status IN ('provisioned', 'active')`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'No server account found' });
    }

    const address = accountResult.rows[0].address;
    const operation = await fundingService.executeFunding(
      userId, 
      address, 
      quote_id, 
      parseFloat(amount_usd), 
      asset, 
      network
    );
    
    res.json(operation);
  } catch (error) {
    console.error('Error executing funding:', error);
    res.status(500).json({ error: 'Failed to execute funding' });
  }
});

// Check funding operation status
fundingRoutes.get('/operations/:operationId/status', async (req, res) => {
  try {
    const userId = requireAuth(req);
    const { operationId } = req.params;

    const operation = await fundingService.checkFundingStatus(operationId);
    
    if (!operation) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    // Verify operation belongs to user
    if (operation.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(operation);
  } catch (error) {
    console.error('Error checking funding status:', error);
    res.status(500).json({ error: 'Failed to check funding status' });
  }
});

// Get funding history
fundingRoutes.get('/history', async (req, res) => {
  try {
    const userId = requireAuth(req);
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await fundingService.getFundingHistory(userId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error fetching funding history:', error);
    res.status(500).json({ error: 'Failed to fetch funding history' });
  }
});

// Get account funding status (for dashboard)
fundingRoutes.get('/status', async (req, res) => {
  try {
    const userId = requireAuth(req);

    // Get user's server account
    const accountResult = await db.query(
      `SELECT address, status, first_funded_at FROM user_accounts 
       WHERE user_id = $1 AND type = 'server'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.json({ 
        has_account: false,
        is_funded: false,
        needs_funding: true
      });
    }

    const account = accountResult.rows[0];
    const isFunded = account.status === 'active' && account.first_funded_at;

    // Get recent funding operations
    const recentFunding = await db.query(
      `SELECT status, amount_usd, asset, created_at 
       FROM account_funding_operations 
       WHERE user_id = $1 AND address = $2
       ORDER BY created_at DESC LIMIT 5`,
      [userId, account.address]
    );

    res.json({
      has_account: true,
      is_funded: isFunded,
      needs_funding: !isFunded,
      account: {
        address: account.address,
        status: account.status,
        first_funded_at: account.first_funded_at
      },
      recent_funding: recentFunding.rows
    });
  } catch (error) {
    console.error('Error checking funding status:', error);
    res.status(500).json({ error: 'Failed to check funding status' });
  }
});
