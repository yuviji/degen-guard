import express from 'express';
import { supabase } from '../../lib/supabase';
import cdpService from '../services/cdp';
import { Account } from '@/shared/types';
import { getUserId } from '../../lib/session';
import { transactionHistoryService } from '../services/transaction-history';

export const accountRoutes = express.Router();

// Get all accounts for a user
accountRoutes.get('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Create a new server-managed wallet (CDP-based)
accountRoutes.post('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user already has a server wallet
    const { data: existing, error: existingError } = await supabase
      .from('user_accounts')
      .select('address')
      .eq('user_id', userId)
      .eq('type', 'server')
      .single();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    
    if (existing) {
      return res.json({ 
        address: existing.address,
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
      const { error: insertError } = await supabase
        .from('user_accounts')
        .upsert({
          user_id: userId,
          type: 'server',
          cdp_account_id: null,
          address: addressString,
          chain: 'base',
          status: 'provisioned'
        });
      
      if (insertError) throw insertError;

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
accountRoutes.get('/:address/balances', async (req, res) => {
  try {
    const { address } = req.params;
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify wallet belongs to user
    const { data: wallet, error: walletError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('address', address)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Get latest balance snapshot from database
    const { data: balance, error: balanceError } = await supabase
      .from('account_balances')
      .select('payload')
      .eq('address', address)
      .order('as_of', { ascending: false })
      .limit(1)
      .single();

    if (balanceError || !balance) {
      return res.status(404).json({ error: 'No balance data found' });
    }

    res.json(balance.payload);
  } catch (error) {
    console.error('Error fetching wallet balances:', error);
    res.status(500).json({ error: 'Failed to fetch wallet balances' });
  }
});

// Get wallet transactions
accountRoutes.get('/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const refresh = req.query.refresh === 'true';
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify wallet belongs to user
    const { data: wallet2, error: walletError2 } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('address', address)
      .eq('user_id', userId)
      .single();

    if (walletError2 || !wallet2) {
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
accountRoutes.delete('/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('user_accounts')
      .delete()
      .eq('address', address)
      .eq('user_id', userId)
      .select();

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    res.status(500).json({ error: 'Failed to delete wallet' });
  }
});
