-- DegenGuard Database Schema
-- CDP-based wallet management with AI-powered monitoring

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
-- WALLET MANAGEMENT TABLES (CDP-based)
-- ============================================================================

-- User wallets table for server-managed wallets
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

-- Wallet balances snapshots
CREATE TABLE wallet_balances (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    as_of TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
);

-- Wallet events for transactions and activities
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

-- Wallet management indexes
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

-- Portfolio metrics view (CDP-based)
CREATE OR REPLACE VIEW portfolio_metrics AS
SELECT 
    uw.user_id,
    uw.address,
    (wb.payload->>'total_usd_value')::DECIMAL as total_usd_value,
    jsonb_array_length(wb.payload->'balances') as token_count
FROM user_wallets uw
JOIN LATERAL (
    SELECT payload 
    FROM wallet_balances 
    WHERE address = uw.address 
    ORDER BY as_of DESC 
    LIMIT 1
) wb ON true
WHERE uw.status = 'active';

-- Recent wallet activity view
CREATE OR REPLACE VIEW recent_wallet_activity AS
SELECT 
    uw.user_id,
    we.address,
    we.occurred_at,
    we.kind,
    we.tx_hash,
    we.details
FROM user_wallets uw
JOIN wallet_events we ON uw.address = we.address
WHERE we.occurred_at >= NOW() - INTERVAL '24 hours'
ORDER BY we.occurred_at DESC;

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
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
