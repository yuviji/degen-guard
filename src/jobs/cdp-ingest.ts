import { cdp, EVM_NETWORK } from '../lib/cdp';
import { db } from '../lib/db';

export async function ingestServerWallet(address: string) {
  try {
    // Fetch balances using CDP SDK
    const result = await cdp.evm.listTokenBalances({ address: address as `0x${string}`, network: EVM_NETWORK });

    // Prepare balance data
    const balanceData = {
      balances: result.balances.map((balance: any) => ({
        asset: balance.token?.symbol || 'UNKNOWN',
        amount: balance.amount?.amount || '0',
        decimals: balance.amount?.decimals || 18,
        symbol: balance.token?.symbol || 'UNKNOWN'
      }))
    };

    // Store balance snapshot
    await db.query(
      `INSERT INTO wallet_balances(address, payload) VALUES ($1, $2)`,
      [address, JSON.stringify(balanceData)]
    );

    console.log(`Ingested balances for wallet ${address}`);
  } catch (error) {
    console.error(`Error ingesting wallet ${address}:`, error);
    throw error;
  }
}

export async function ingestWalletTransactions(address: string) {
  try {
    // TODO: Implement transaction ingestion when CDP SDK supports it
    // For now, we'll focus on balance ingestion
    console.log(`Transaction ingestion for ${address} - TODO: implement when CDP SDK supports listTransactions`);
  } catch (error) {
    console.error(`Error ingesting transactions for wallet ${address}:`, error);
    throw error;
  }
}

export async function ingestAllActiveWallets() {
  try {
    // Get all active wallets
    const { rows } = await db.query(
      `SELECT address FROM user_wallets WHERE status = 'active'`
    );

    for (const wallet of rows) {
      await ingestServerWallet(wallet.address);
      await ingestWalletTransactions(wallet.address);
    }

    console.log(`Ingested data for ${rows.length} active wallets`);
  } catch (error) {
    console.error('Error ingesting all active wallets:', error);
    throw error;
  }
}
