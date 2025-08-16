import cron from 'node-cron';
import pool from '../database/connection';
import cdpService from '../server/services/cdp';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'data-ingestion.log' })
  ]
});

class DataIngestionWorker {
  async syncAllWallets(): Promise<void> {
    try {
      logger.info('Starting wallet data sync cycle');

      // Get all active user wallets
      const walletsResult = await pool.query('SELECT * FROM user_wallets WHERE status = \'active\'');
      
      for (const wallet of walletsResult.rows) {
        await this.syncWalletData(wallet);
      }

      logger.info(`Completed sync for ${walletsResult.rows.length} wallets`);
    } catch (error) {
      logger.error('Error in wallet sync cycle:', error);
    }
  }

  async syncWalletData(wallet: any): Promise<void> {
    try {
      logger.info(`Syncing wallet ${wallet.address} on ${wallet.chain}`);

      // Fetch and store balances
      await this.syncWalletBalances(wallet);
      
      // Fetch and store transactions
      await this.syncWalletTransactions(wallet);

      logger.info(`Successfully synced wallet ${wallet.address}`);
    } catch (error) {
      logger.error(`Error syncing wallet ${wallet.address}:`, error);
    }
  }

  async syncWalletBalances(wallet: any): Promise<void> {
    try {
      const balances = await cdpService.getWalletBalances(wallet.address, wallet.chain);

      // Calculate total USD value
      let totalUsdValue = 0;
      const balanceEntries = [];

      for (const balance of balances) {
        // Get current price if not available
        let pricePerToken = 0;
        let usdValue = 0;
        
        if (balance.usd_value && parseFloat(balance.amount) > 0) {
          pricePerToken = parseFloat(balance.usd_value.amount) / parseFloat(balance.amount);
          usdValue = parseFloat(balance.usd_value.amount);
        } else {
          // Fetch price from CDP
          try {
            const price = await cdpService.getTokenPrice(balance.currency.code);
            pricePerToken = parseFloat(price.amount);
            usdValue = parseFloat(balance.amount) * pricePerToken;
          } catch (error) {
            logger.warn(`Failed to get price for ${balance.currency.code}:`, error);
          }
        }

        totalUsdValue += usdValue;
        balanceEntries.push({
          symbol: balance.currency.code,
          name: balance.currency.name,
          address: balance.currency.address,
          balance: balance.amount,
          usd_value: usdValue.toString(),
          price_per_token: pricePerToken
        });
      }

      // Store wallet balance snapshot in new format
      await pool.query(`
        INSERT INTO wallet_balances (address, payload)
        VALUES ($1, $2)
      `, [
        wallet.address,
        JSON.stringify({
          total_usd_value: totalUsdValue.toString(),
          balances: balanceEntries
        })
      ]);

      logger.info(`Stored balance snapshot for wallet ${wallet.address} with total value $${totalUsdValue.toFixed(2)}`);
    } catch (error) {
      logger.error(`Error syncing balances for wallet ${wallet.address}:`, error);
    }
  }

  async syncWalletTransactions(wallet: any): Promise<void> {
    try {
      const transactions = await cdpService.getWalletTransactions(wallet.address, wallet.chain, 20);

      for (const tx of transactions) {
        // Check if transaction already exists
        const existingTx = await pool.query(
          'SELECT id FROM wallet_events WHERE tx_hash = $1',
          [tx.hash]
        );

        if (existingTx.rows.length > 0) {
          continue; // Skip if already exists
        }

        // Determine event kind based on transaction data
        let kind = 'other';
        if (tx.from_address?.toLowerCase() === wallet.address.toLowerCase()) {
          kind = 'transfer_out';
        } else if (tx.to_address?.toLowerCase() === wallet.address.toLowerCase()) {
          kind = 'transfer_in';
        }
        if (tx.type && tx.type.toLowerCase().includes('swap')) {
          kind = 'swap';
        }

        // Calculate USD value if available
        let usdValue = '0';
        if (tx.value && tx.value.currency !== 'USD') {
          try {
            const price = await cdpService.getTokenPrice(tx.value.currency);
            usdValue = (parseFloat(tx.value.amount) * parseFloat(price.amount)).toString();
          } catch (error) {
            logger.warn(`Failed to calculate USD value for transaction ${tx.hash}:`, error);
          }
        }

        // Insert transaction in new format
        await pool.query(`
          INSERT INTO wallet_events (
            address,
            occurred_at,
            kind,
            tx_hash,
            chain,
            details
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          wallet.address,
          new Date(tx.block_timestamp),
          kind,
          tx.hash,
          wallet.chain,
          JSON.stringify({
            block_height: tx.block_height,
            from_address: tx.from_address,
            to_address: tx.to_address,
            amount: tx.value?.amount || '0',
            currency: tx.value?.currency,
            usd_value: usdValue,
            type: tx.type
          })
        ]);
      }

      logger.info(`Stored ${transactions.length} transactions for wallet ${wallet.address}`);
    } catch (error) {
      logger.error(`Error syncing transactions for wallet ${wallet.address}:`, error);
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      // Keep only last 30 days of wallet balance snapshots
      await pool.query(`
        DELETE FROM wallet_balances 
        WHERE as_of < NOW() - INTERVAL '30 days'
      `);

      // Keep only last 90 days of wallet events
      await pool.query(`
        DELETE FROM wallet_events 
        WHERE occurred_at < NOW() - INTERVAL '90 days'
      `);

      // Keep only last 30 days of rule evaluations
      await pool.query(`
        DELETE FROM rule_evaluations 
        WHERE timestamp < NOW() - INTERVAL '30 days'
      `);

      logger.info('Completed data cleanup');
    } catch (error) {
      logger.error('Error during data cleanup:', error);
    }
  }
}

// Initialize and start the data ingestion worker
const dataWorker = new DataIngestionWorker();

// Sync wallet data every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await dataWorker.syncAllWallets();
});

// Cleanup old data daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await dataWorker.cleanupOldData();
});

logger.info('Data ingestion worker started - syncing every 5 minutes');

// Keep the process running
process.on('SIGINT', () => {
  logger.info('Data ingestion worker shutting down...');
  process.exit(0);
});
