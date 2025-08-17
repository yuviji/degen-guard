import { supabase } from '../lib/supabase';

async function seed() {
  try {
    console.log('Seeding Supabase database...');
    
    // Create a demo user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({ email: 'demo@degenguard.com', password_hash: 'demo_hash' })
      .select('id')
      .single();
    
    if (userError) throw userError;
    const userId = userData.id;
    
    // Create demo server account (note: using user_accounts, not user_wallets)
    const { error: accountError } = await supabase
      .from('user_accounts')
      .upsert({
        user_id: userId,
        type: 'server',
        address: '0x742d35cc6634c0532925a3b8d6ac6e1f5b0e6e8f',
        chain: 'base',
        status: 'active'
      });
    
    if (accountError) throw accountError;
    
    // Create demo rules
    const { error: rulesError } = await supabase
      .from('rules')
      .upsert([
        {
          user_id: userId,
          name: 'Stablecoin Alert',
          description: 'Alert when stablecoins drop below 30%',
          rule_json: {
            triggers: [{ metric: 'stablecoin_allocation_pct', op: '<', value: 30 }],
            logic: 'ANY',
            actions: [{ type: 'ALERT', message: 'Stablecoin allocation below 30%', severity: 'medium' }]
          }
        },
        {
          user_id: userId,
          name: 'Daily PnL Alert',
          description: 'Alert when daily PnL drops below -5%',
          rule_json: {
            triggers: [{ metric: 'daily_pnl_pct', op: '<', value: -5 }],
            logic: 'ANY',
            actions: [{ type: 'ALERT', message: 'Daily PnL below -5%', severity: 'high' }]
          }
        }
      ]);
    
    if (rulesError) throw rulesError;
    
    console.log('Supabase database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
