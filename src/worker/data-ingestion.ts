// import cron from 'node-cron';
// import pool from '../database/connection';
// import cdpService from '../server/services/cdp';
// import winston from 'winston';

// // Configure logger
// const logger = winston.createLogger({
//   level: 'info',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()
//   ),
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({ filename: 'data-ingestion.log' })
//   ]
// });

// class DataIngestionWorker {
//   async syncAllWallets(): Promise<void> {
//     try {
//       logger.info('Starting wallet data sync cycle');

//       // Get all active user accounts
//       const accountsResult = await pool.query('SELECT * FROM user_accounts WHERE status = \'active\'');
      
//       for (const account of accountsResult.rows) {
//         await this.syncAccountData(account);
//       }

//       logger.info(`Completed sync for ${accountsResult.rows.length} accounts`);
//     } catch (error) {
//       logger.error('Error in wallet sync cycle:', error);
//     }
//   }

//   async syncAccountData(account: any): Promise<void> {
//     try {
//       logger.info(`Syncing account ${account.address} on ${account.chain}`);

//       // Fetch and store balances
//       await this.syncAccountBalances(account);
      
//       // Fetch and store transactions
//       await this.syncAccountTransactions(account);

//       logger.info(`Successfully synced account ${account.address}`);
//     } catch (error) {
//       logger.error(`Error syncing account ${account.address}:`, error);
//     }
//   }

//   async syncAccountBalances(account: any): Promise<void> {
//     try {
//       const balances = await cdpService.getWalletBalances(account.address, account.chain);

//       // Calculate total USD value
//       let totalUsdValue = 0;
//       const balanceEntries = [];

//       for (const balance of balances) {
//         // Get current price if not available
//         let pricePerToken = 0;
//         let usdValue = 0;
        
//         if (balance.usd_value && parseFloat(balance.amount) > 0) {
//           pricePerToken = parseFloat(balance.usd_value.amount) / parseFloat(balance.amount);
//           usdValue = parseFloat(balance.usd_value.amount);
//         } else {
//           // Fetch price from CDP
//           try {
//             const price = await cdpService.getTokenPrice(balance.currency.code);
//             pricePerToken = parseFloat(price.amount);
//             usdValue = parseFloat(balance.amount) * pricePerToken;
//           } catch (error) {
//             logger.warn(`Failed to get price for ${balance.currency.code}:`, error);
//           }
//         }

//         totalUsdValue += usdValue;
//         balanceEntries.push({
//           symbol: balance.currency.code,
//           name: balance.currency.name,
//           address: balance.currency.address,
//           balance: balance.amount,
//           usd_value: usdValue.toString(),
//           price_per_token: pricePerToken
//         });
//       }

//       // Store account balance snapshot in new format
//       await pool.query(`
//         INSERT INTO account_balances (address, payload)
//         VALUES ($1, $2)
//       `, [
//         account.address,
//         JSON.stringify({
//           total_usd_value: totalUsdValue.toString(),
//           balances: balanceEntries
//         })
//       ]);

//       logger.info(`Stored balance snapshot for account ${account.address} with total value $${totalUsdValue.toFixed(2)}`);
//     } catch (error) {
//       logger.error(`Error syncing balances for account ${account.address}:`, error);
//     }
//   }

//   async syncAccountTransactions(account: any): Promise<void> {
//     try {
//       const transactions = await cdpService.getWalletTransactions(account.address, account.chain, 20);

//       for (const tx of transactions) {
//         // Check if transaction already exists
//         const existingTx = await pool.query(
//           'SELECT id FROM account_events WHERE tx_hash = $1',
//           [tx.hash]
//         );

//         if (existingTx.rows.length > 0) {
//           continue; // Skip if already exists
//         }

//         // Determine event kind based on transaction data
//         let kind = 'other';
//         if (tx.from_address?.toLowerCase() === account.address.toLowerCase()) {
//           kind = 'transfer_out';
//         } else if (tx.to_address?.toLowerCase() === account.address.toLowerCase()) {
//           kind = 'transfer_in';
//         }
//         if (tx.type && tx.type.toLowerCase().includes('swap')) {
//           kind = 'swap';
//         }

//         // Calculate USD value if available
//         let usdValue = '0';
//         if (tx.value && tx.value.currency !== 'USD') {
//           try {
//             const price = await cdpService.getTokenPrice(tx.value.currency);
//             usdValue = (parseFloat(tx.value.amount) * parseFloat(price.amount)).toString();
//           } catch (error) {
//             logger.warn(`Failed to calculate USD value for transaction ${tx.hash}:`, error);
//           }
//         }

//         // Insert transaction in new format
//         await pool.query(`
//           INSERT INTO account_events (
//             address,
//             occurred_at,
//             kind,
//             tx_hash,
//             chain,
//             details
//           )
//           VALUES ($1, $2, $3, $4, $5, $6)
//         `, [
//           account.address,
//           new Date(tx.block_timestamp),
//           kind,
//           tx.hash,
//           account.chain,
//           JSON.stringify({
//             block_height: tx.block_height,
//             from_address: tx.from_address,
//             to_address: tx.to_address,
//             amount: tx.value?.amount || '0',
//             currency: tx.value?.currency,
//             usd_value: usdValue,
//             type: tx.type
//           })
//         ]);
//       }

//       logger.info(`Stored ${transactions.length} transactions for account ${account.address}`);
//     } catch (error) {
//       logger.error(`Error syncing transactions for account ${account.address}:`, error);
//     }
//   }

//   async cleanupOldData(): Promise<void> {
//     try {
//       // Keep only last 30 days of account balance snapshots
//       await pool.query(`
//         DELETE FROM account_balances 
//         WHERE as_of < NOW() - INTERVAL '30 days'
//       `);

//       // Keep only last 90 days of account events
//       await pool.query(`
//         DELETE FROM account_events 
//         WHERE occurred_at < NOW() - INTERVAL '90 days'
//       `);

//       // Keep only last 30 days of rule evaluations
//       await pool.query(`
//         DELETE FROM rule_evaluations 
//         WHERE timestamp < NOW() - INTERVAL '30 days'
//       `);

//       logger.info('Completed data cleanup');
//     } catch (error) {
//       logger.error('Error during data cleanup:', error);
//     }
//   }
// }

// // Initialize and start the data ingestion worker
// const dataWorker = new DataIngestionWorker();

// // Sync account data every 5 seconds
// cron.schedule('*/5 * * * * *', async () => {
//   await dataWorker.syncAllWallets();
// });

// // Cleanup old data daily at 2 AM
// cron.schedule('0 2 * * *', async () => {
//   await dataWorker.cleanupOldData();
// });

// logger.info('Data ingestion worker started - syncing every 5 seconds');

// // Keep the process running
// process.on('SIGINT', () => {
//   logger.info('Data ingestion worker shutting down...');
//   process.exit(0);
// });
