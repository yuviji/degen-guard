-- DegenGuard Database Schema
-- Complete schema with both legacy wallet tracking and CDP onboarding tables

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- LEGACY WALLET TRACKING TABLES (for manually added wallets)
-- ============================================================================

-- Wallets table (for manually added/tracked wallets)
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(address, chain)
);

-- Asset snapshots table (for legacy wallet tracking)
CREATE TABLE asset_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    token_address VARCHAR(42),
    token_symbol VARCHAR(20) NOT NULL,
    token_name VARCHAR(100),
    balance DECIMAL(36, 18) NOT NULL,
    usd_value DECIMAL(20, 8),
    price_per_token DECIMAL(20, 8),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chain events table (for legacy wallet tracking)
CREATE TABLE chain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('transfer', 'swap', 'deposit', 'withdrawal')),
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    token_address VARCHAR(42),
    amount DECIMAL(36, 18),
    usd_value DECIMAL(20, 8),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CDP ONBOARDING TABLES (for server-managed wallets)
-- ============================================================================

-- User wallets table for CDP server wallets
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('server')),
    cdp_wallet_id TEXT,
    address TEXT NOT NULL,
    chain TEXT NOT NULL DEFAULT 'base',
    status TEXT NOT NULL DEFAULT 'provisioned' CHECK (status IN ('provisioned', 'funding', 'active')),
    first_funded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, type),
    UNIQUE(address)
);

-- Wallet balances snapshots (CDP format)
CREATE TABLE wallet_balances (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    as_of TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
);

-- Wallet events for transactions and activities (CDP format)
CREATE TABLE wallet_events (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('transfer_in', 'transfer_out', 'swap', 'approval', 'other')),
    tx_hash TEXT UNIQUE,
    chain TEXT DEFAULT 'base',
    details JSONB
);

-- ============================================================================
-- RULES AND ALERTS TABLES
-- ============================================================================

-- Rules table
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    rule_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rule evaluations table
CREATE TABLE rule_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    triggered BOOLEAN NOT NULL,
    evaluation_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Legacy wallet indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_address_chain ON wallets(address, chain);
CREATE INDEX idx_asset_snapshots_wallet_id ON asset_snapshots(wallet_id);
CREATE INDEX idx_asset_snapshots_timestamp ON asset_snapshots(timestamp);
CREATE INDEX idx_chain_events_wallet_id ON chain_events(wallet_id);
CREATE INDEX idx_chain_events_timestamp ON chain_events(timestamp);
CREATE INDEX idx_chain_events_tx_hash ON chain_events(transaction_hash);

-- CDP onboarding indexes
CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_user_wallets_address ON user_wallets(address);
CREATE INDEX idx_user_wallets_status ON user_wallets(status);
CREATE INDEX idx_wallet_balances_address ON wallet_balances(address);
CREATE INDEX idx_wallet_balances_as_of ON wallet_balances(as_of);
CREATE INDEX idx_wallet_events_address ON wallet_events(address);
CREATE INDEX idx_wallet_events_occurred_at ON wallet_events(occurred_at);
CREATE INDEX idx_wallet_events_tx_hash ON wallet_events(tx_hash);

-- Rules and alerts indexes
CREATE INDEX idx_rules_user_id ON rules(user_id);
CREATE INDEX idx_rules_active ON rules(is_active);
CREATE INDEX idx_rule_evaluations_rule_id ON rule_evaluations(rule_id);
CREATE INDEX idx_rule_evaluations_timestamp ON rule_evaluations(timestamp);
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Portfolio metrics view (legacy wallets)
CREATE OR REPLACE VIEW portfolio_metrics AS
SELECT 
    w.user_id,
    w.id as wallet_id,
    SUM(a.usd_value) as total_usd_value,
    COUNT(DISTINCT a.token_symbol) as token_count
FROM wallets w
JOIN asset_snapshots a ON w.id = a.wallet_id
WHERE a.timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY w.user_id, w.id;

-- Stablecoin allocations view (legacy wallets)
CREATE OR REPLACE VIEW stablecoin_allocations AS
SELECT 
    w.user_id,
    w.id as wallet_id,
    SUM(CASE WHEN a.token_symbol IN ('USDC', 'USDT', 'DAI', 'BUSD', 'FRAX') THEN a.usd_value ELSE 0 END) as stablecoin_value,
    SUM(a.usd_value) as total_value,
    CASE 
        WHEN SUM(a.usd_value) > 0 THEN 
            (SUM(CASE WHEN a.token_symbol IN ('USDC', 'USDT', 'DAI', 'BUSD', 'FRAX') THEN a.usd_value ELSE 0 END) / SUM(a.usd_value)) * 100
        ELSE 0 
    END as stablecoin_allocation_pct
FROM wallets w
JOIN asset_snapshots a ON w.id = a.wallet_id
WHERE a.timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY w.user_id, w.id;

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
