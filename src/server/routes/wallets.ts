import express from 'express';
import pool from '../../database/connection';
import cdpService from '../services/cdp';
import { Wallet } from '@/shared/types';
import { getUserId } from '../../lib/session';
import { transactionHistoryService } from '../services/transaction-history';

export const walletRoutes = express.Router();

// Get all wallets for a user
walletRoutes.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'SELECT * FROM user_wallets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Create a new server-managed wallet (CDP-based)
walletRoutes.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user already has a server wallet
    const existing = await pool.query(
      `SELECT address FROM user_wallets WHERE user_id = $1 AND type = 'server'`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.json({ 
        address: existing.rows[0].address,
        message: 'Wallet already exists' 
      });
    }

    // Redirect to CDP onboarding endpoint by making internal call
    try {
      const { cdp, EVM_NETWORK } = require('../../lib/cdp');
      
      // Create a new EVM account using CDP SDK
      const account = await cdp.evm.createAccount({ name: `wallet-${Date.now()}` });
      const addressString = account.address.toLowerCase();

      // Store in database
      await pool.query(
        `INSERT INTO user_wallets(user_id, type, cdp_wallet_id, address, chain, status)
         VALUES ($1, 'server', $2, $3, $4, 'provisioned')
         ON CONFLICT (user_id, type) DO NOTHING`,
        [userId, null, addressString, 'base']
      );

      res.status(201).json({ 
        address: addressString,
        message: 'Wallet created successfully' 
      });
    } catch (cdpError) {
      console.error('CDP wallet creation error:', cdpError);
      res.status(500).json({ error: 'Failed to create wallet via CDP' });
    }
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

// Get wallet balances
walletRoutes.get('/:address/balances', async (req, res) => {
  try {
    const { address } = req.params;
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify wallet belongs to user
    const walletResult = await pool.query(
      'SELECT * FROM user_wallets WHERE address = $1 AND user_id = $2',
      [address, userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Get latest balance snapshot from database
    const balanceResult = await pool.query(
      `SELECT payload FROM wallet_balances 
       WHERE address = $1 
       ORDER BY as_of DESC 
       LIMIT 1`,
      [address]
    );

    if (balanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'No balance data found' });
    }

    res.json(balanceResult.rows[0].payload);
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    res.status(500).json({ error: 'Failed to fetch wallet balances' });
  }
});

// Get wallet transactions
walletRoutes.get('/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const refresh = req.query.refresh === 'true';
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify wallet belongs to user
    const walletResult = await pool.query(
      'SELECT * FROM user_wallets WHERE address = $1 AND user_id = $2',
      [address, userId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Use transaction history service to get transactions
    const transactions = await transactionHistoryService.getTransactions(address, limit, refresh);
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({ error: 'Failed to fetch wallet transactions' });
  }
});

// Delete a wallet
walletRoutes.delete('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await pool.query(
      'DELETE FROM user_wallets WHERE address = $1 AND user_id = $2 RETURNING *',
      [address, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    res.status(500).json({ error: 'Failed to delete wallet' });
  }
});
