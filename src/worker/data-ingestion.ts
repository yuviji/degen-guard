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

      // Get all wallets
      const walletsResult = await pool.query('SELECT * FROM wallets');
      
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

      for (const balance of balances) {
        // Get current price if not available
        let pricePerToken = 0;
        if (balance.usd_value && parseFloat(balance.amount) > 0) {
          pricePerToken = parseFloat(balance.usd_value.amount) / parseFloat(balance.amount);
        } else {
          // Fetch price from CDP
          try {
            const price = await cdpService.getTokenPrice(balance.currency.code);
            pricePerToken = parseFloat(price.amount);
          } catch (error) {
            logger.warn(`Failed to get price for ${balance.currency.code}:`, error);
          }
        }

        // Insert balance snapshot
        await pool.query(`
          INSERT INTO asset_snapshots (
            wallet_id, 
            token_address, 
            token_symbol, 
            token_name, 
            balance, 
            usd_value, 
            price_per_token
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          wallet.id,
          balance.currency.address,
          balance.currency.code,
          balance.currency.name,
          balance.amount,
          balance.usd_value?.amount || (parseFloat(balance.amount) * pricePerToken).toString(),
          pricePerToken
        ]);
      }

      logger.info(`Stored ${balances.length} balance entries for wallet ${wallet.address}`);
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
          'SELECT id FROM chain_events WHERE transaction_hash = $1',
          [tx.hash]
        );

        if (existingTx.rows.length > 0) {
          continue; // Skip if already exists
        }

        // Determine event type based on transaction data
        let eventType = 'transfer';
        if (tx.type && tx.type.toLowerCase().includes('swap')) {
          eventType = 'swap';
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

        // Insert transaction
        await pool.query(`
          INSERT INTO chain_events (
            wallet_id,
            transaction_hash,
            block_number,
            event_type,
            from_address,
            to_address,
            amount,
            usd_value,
            timestamp
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          wallet.id,
          tx.hash,
          tx.block_height,
          eventType,
          tx.from_address,
          tx.to_address,
          tx.value?.amount || '0',
          usdValue,
          new Date(tx.block_timestamp)
        ]);
      }

      logger.info(`Stored ${transactions.length} transactions for wallet ${wallet.address}`);
    } catch (error) {
      logger.error(`Error syncing transactions for wallet ${wallet.address}:`, error);
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      // Keep only last 30 days of asset snapshots
      await pool.query(`
        DELETE FROM asset_snapshots 
        WHERE timestamp < NOW() - INTERVAL '30 days'
      `);

      // Keep only last 90 days of chain events
      await pool.query(`
        DELETE FROM chain_events 
        WHERE timestamp < NOW() - INTERVAL '90 days'
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
