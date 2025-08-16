import pool from './connection';

async function seed() {
  try {
    console.log('Seeding database...');
    
    // Create a demo user
    const userResult = await pool.query(`
      INSERT INTO users (email) 
      VALUES ('demo@degenguard.com') 
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `);
    
    const userId = userResult.rows[0].id;
    
    // Create demo wallets
    await pool.query(`
      INSERT INTO wallets (user_id, address, chain, label) 
      VALUES 
        ($1, '0x742d35cc6634c0532925a3b8d6ac6e1f5b0e6e8f', 'ethereum', 'Main Wallet'),
        ($1, '0x8ba1f109551bd432803012645hac136c', 'polygon', 'DeFi Wallet')
      ON CONFLICT (address, chain) DO NOTHING
    `, [userId]);
    
    // Create demo rules
    await pool.query(`
      INSERT INTO rules (user_id, name, description, rule_json) 
      VALUES 
        ($1, 'Stablecoin Alert', 'Alert when stablecoins drop below 30%', $2),
        ($1, 'Daily PnL Alert', 'Alert when daily PnL drops below -5%', $3)
      ON CONFLICT DO NOTHING
    `, [
      userId,
      JSON.stringify({
        triggers: [{ metric: 'stablecoin_allocation_pct', op: '<', value: 30 }],
        logic: 'ANY',
        actions: [{ type: 'ALERT', message: 'Stablecoin allocation below 30%', severity: 'medium' }]
      }),
      JSON.stringify({
        triggers: [{ metric: 'daily_pnl_pct', op: '<', value: -5 }],
        logic: 'ANY',
        actions: [{ type: 'ALERT', message: 'Daily PnL below -5%', severity: 'high' }]
      })
    ]);
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
