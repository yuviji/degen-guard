import express from 'express';
import pool from '../../database/connection';
import cdpService from '../services/cdp';
import { Wallet } from '@/shared/types';

export const walletRoutes = express.Router();

// Get all wallets for a user
walletRoutes.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Add a new wallet
walletRoutes.post('/', async (req, res) => {
  try {
    const { userId, address, chain, label } = req.body;

    if (!userId || !address || !chain) {
      return res.status(400).json({ error: 'User ID, address, and chain are required' });
    }

    // Validate address format
    const isValid = await cdpService.validateAddress(address, chain);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const result = await pool.query(
      `INSERT INTO wallets (user_id, address, chain, label) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, address, chain, label]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding wallet:', error);
    if ((error as any).code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'Wallet already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add wallet' });
    }
  }
});

// Get wallet balances
walletRoutes.get('/:walletId/balances', async (req, res) => {
  try {
    const { walletId } = req.params;

    // Get wallet info
    const walletResult = await pool.query(
      'SELECT * FROM wallets WHERE id = $1',
      [walletId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];

    // Fetch balances from CDP
    const balances = await cdpService.getWalletBalances(wallet.address, wallet.chain);

    // Store balances in database
    for (const balance of balances) {
      await pool.query(
        `INSERT INTO asset_snapshots (wallet_id, token_address, token_symbol, token_name, balance, usd_value, price_per_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          walletId,
          balance.currency.address,
          balance.currency.code,
          balance.currency.name,
          balance.amount,
          balance.usd_value?.amount || '0',
          balance.usd_value ? parseFloat(balance.usd_value.amount) / parseFloat(balance.amount) : 0
        ]
      );
    }

    res.json(balances);
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    res.status(500).json({ error: 'Failed to fetch wallet balances' });
  }
});

// Get wallet transactions
walletRoutes.get('/:walletId/transactions', async (req, res) => {
  try {
    const { walletId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get wallet info
    const walletResult = await pool.query(
      'SELECT * FROM wallets WHERE id = $1',
      [walletId]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];

    // Fetch transactions from CDP
    const transactions = await cdpService.getWalletTransactions(wallet.address, wallet.chain, limit);

    // Store transactions in database
    for (const tx of transactions) {
      await pool.query(
        `INSERT INTO chain_events (wallet_id, transaction_hash, block_number, event_type, from_address, to_address, amount, usd_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (transaction_hash) DO NOTHING`,
        [
          walletId,
          tx.hash,
          tx.block_height,
          'transfer', // Default type, could be enhanced
          tx.from_address,
          tx.to_address,
          tx.value?.amount || '0',
          '0' // Would need price calculation
        ]
      );
    }

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({ error: 'Failed to fetch wallet transactions' });
  }
});

// Delete a wallet
walletRoutes.delete('/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;

    const result = await pool.query(
      'DELETE FROM wallets WHERE id = $1 RETURNING *',
      [walletId]
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
