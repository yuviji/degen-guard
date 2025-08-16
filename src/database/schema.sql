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
-- EVM ACCOUNT MANAGEMENT TABLES (CDP-based)
-- ============================================================================

-- User EVM accounts table for server-managed accounts
CREATE TABLE user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('server')),
    cdp_account_id TEXT,
    address TEXT NOT NULL,
    chain TEXT NOT NULL DEFAULT 'base',
    status TEXT NOT NULL DEFAULT 'provisioned' CHECK (status IN ('provisioned', 'funding', 'active')),
    first_funded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, type),
    UNIQUE(address)
);

-- Account balances snapshots
CREATE TABLE account_balances (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    as_of TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL
);

-- Account events for transactions and activities
CREATE TABLE account_events (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('transfer_in', 'transfer_out', 'swap', 'approval', 'funding', 'other')),
    tx_hash TEXT UNIQUE,
    chain TEXT DEFAULT 'base',
    details JSONB
);

-- Account funding operations table
CREATE TABLE account_funding_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    amount_usd DECIMAL(20, 8) NOT NULL,
    asset TEXT NOT NULL, -- 'USDC', 'ETH', etc.
    network TEXT NOT NULL DEFAULT 'base',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    cdp_operation_id TEXT,
    quote_id TEXT,
    payment_method_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
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

-- Account management indexes
CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_user_accounts_address ON user_accounts(address);
CREATE INDEX idx_user_accounts_status ON user_accounts(status);
CREATE INDEX idx_account_balances_address ON account_balances(address);
CREATE INDEX idx_account_balances_as_of ON account_balances(as_of);
CREATE INDEX idx_account_events_address ON account_events(address);
CREATE INDEX idx_account_events_occurred_at ON account_events(occurred_at);
CREATE INDEX idx_account_events_tx_hash ON account_events(tx_hash);
CREATE INDEX idx_account_funding_operations_user_id ON account_funding_operations(user_id);
CREATE INDEX idx_account_funding_operations_address ON account_funding_operations(address);
CREATE INDEX idx_account_funding_operations_status ON account_funding_operations(status);

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
    ua.user_id,
    ua.address,
    (ab.payload->>'total_usd_value')::DECIMAL as total_usd_value,
    jsonb_array_length(ab.payload->'balances') as token_count
FROM user_accounts ua
JOIN LATERAL (
    SELECT payload 
    FROM account_balances 
    WHERE address = ua.address 
    ORDER BY as_of DESC 
    LIMIT 1
) ab ON true
WHERE ua.status = 'active';

-- Recent account activity view
CREATE OR REPLACE VIEW recent_account_activity AS
SELECT 
    ua.user_id,
    ae.address,
    ae.occurred_at,
    ae.kind,
    ae.tx_hash,
    ae.details
FROM user_accounts ua
JOIN account_events ae ON ua.address = ae.address
WHERE ae.occurred_at >= NOW() - INTERVAL '24 hours'
ORDER BY ae.occurred_at DESC;

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
