import cron from 'node-cron';
import pool from '../database/connection';
import { RuleDefinition, PortfolioMetrics } from '@/shared/types';
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
    new winston.transports.File({ filename: 'rules-engine.log' })
  ]
});

class RulesEngine {
  async evaluateAllRules(): Promise<void> {
    try {
      logger.info('Starting rule evaluation cycle');

      // Get all active rules
      const rulesResult = await pool.query(`
        SELECT r.*, u.id as user_id 
        FROM rules r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.is_active = true
      `);

      for (const rule of rulesResult.rows) {
        await this.evaluateRule(rule);
      }

      logger.info(`Completed evaluation of ${rulesResult.rows.length} rules`);
    } catch (error) {
      logger.error('Error in rule evaluation cycle:', error);
    }
  }

  async evaluateRule(rule: any): Promise<void> {
    try {
      const ruleDefinition: RuleDefinition = rule.rule_json;
      const userId = rule.user_id;

      // Get portfolio metrics for the user
      const metrics = await this.getPortfolioMetrics(userId);

      // Evaluate triggers
      const triggerResults = ruleDefinition.triggers.map(trigger => {
        const metricValue = this.getMetricValue(metrics, trigger.metric);
        return this.evaluateTrigger(metricValue, trigger.op, trigger.value);
      });

      // Apply logic (ALL or ANY)
      const triggered = ruleDefinition.logic === 'ALL' 
        ? triggerResults.every(result => result)
        : triggerResults.some(result => result);

      // Log evaluation
      await pool.query(`
        INSERT INTO rule_evaluations (rule_id, triggered, evaluation_data)
        VALUES ($1, $2, $3)
      `, [
        rule.id,
        triggered,
        JSON.stringify({
          metrics,
          trigger_results: triggerResults,
          logic: ruleDefinition.logic
        })
      ]);

      // If triggered, execute actions
      if (triggered) {
        await this.executeActions(rule, ruleDefinition.actions, metrics);
      }

      logger.info(`Evaluated rule ${rule.name}: ${triggered ? 'TRIGGERED' : 'NOT_TRIGGERED'}`);
    } catch (error) {
      logger.error(`Error evaluating rule ${rule.name}:`, error);
    }
  }

  async getPortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
    // Get total portfolio value from latest wallet balance
    const totalValueResult = await pool.query(`
      SELECT 
        COALESCE((wb.payload->>'total_usd_value')::DECIMAL, 0) as total_usd_value
      FROM user_wallets uw
      JOIN LATERAL (
        SELECT payload 
        FROM wallet_balances 
        WHERE address = uw.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) wb ON true
      WHERE uw.user_id = $1 AND uw.status = 'active'
    `, [userId]);

    // Get stablecoin allocation from wallet balance payload
    const stablecoinResult = await pool.query(`
      SELECT 
        COALESCE(
          (SELECT SUM((balance->>'usd_value')::DECIMAL)
           FROM jsonb_array_elements(wb.payload->'balances') AS balance
           WHERE balance->>'symbol' IN ('USDC', 'USDT', 'DAI', 'BUSD', 'FRAX')), 0
        ) as stablecoin_value,
        COALESCE((wb.payload->>'total_usd_value')::DECIMAL, 0) as total_value
      FROM user_wallets uw
      JOIN LATERAL (
        SELECT payload 
        FROM wallet_balances 
        WHERE address = uw.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) wb ON true
      WHERE uw.user_id = $1 AND uw.status = 'active'
    `, [userId]);

    // Get largest position from wallet balance payload
    const largestPositionResult = await pool.query(`
      SELECT 
        MAX(
          CASE 
            WHEN (wb.payload->>'total_usd_value')::DECIMAL > 0 THEN 
              ((balance->>'usd_value')::DECIMAL / (wb.payload->>'total_usd_value')::DECIMAL) * 100
            ELSE 0 
          END
        ) as largest_position_pct
      FROM user_wallets uw
      JOIN LATERAL (
        SELECT payload 
        FROM wallet_balances 
        WHERE address = uw.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) wb ON true,
      jsonb_array_elements(wb.payload->'balances') AS balance
      WHERE uw.user_id = $1 AND uw.status = 'active'
    `, [userId]);

    // Calculate daily PnL from wallet balance history
    const dailyPnlResult = await pool.query(`
      SELECT 
        COALESCE(
          CASE 
            WHEN prev_balance.total_value > 0 THEN
              ((current_balance.total_value - prev_balance.total_value) / prev_balance.total_value) * 100
            ELSE 0
          END,
          0
        ) as daily_pnl_pct
      FROM user_wallets uw
      LEFT JOIN LATERAL (
        SELECT (payload->>'total_usd_value')::DECIMAL as total_value
        FROM wallet_balances 
        WHERE address = uw.address 
        ORDER BY as_of DESC 
        LIMIT 1
      ) current_balance ON true
      LEFT JOIN LATERAL (
        SELECT (payload->>'total_usd_value')::DECIMAL as total_value
        FROM wallet_balances 
        WHERE address = uw.address 
          AND as_of <= NOW() - INTERVAL '24 hours'
        ORDER BY as_of DESC 
        LIMIT 1
      ) prev_balance ON true
      WHERE uw.user_id = $1 AND uw.status = 'active'
    `, [userId]);

    const totalValue = parseFloat(totalValueResult.rows[0]?.total_usd_value || '0');
    const stablecoinValue = parseFloat(stablecoinResult.rows[0]?.stablecoin_value || '0');

    return {
      total_usd_value: totalValue,
      daily_pnl_pct: parseFloat(dailyPnlResult.rows[0]?.daily_pnl_pct || '0'),
      stablecoin_allocation_pct: totalValue > 0 ? (stablecoinValue / totalValue) * 100 : 0,
      largest_position_pct: parseFloat(largestPositionResult.rows[0]?.largest_position_pct || '0'),
      asset_allocations: []
    };
  }

  getMetricValue(metrics: PortfolioMetrics, metricName: string): number {
    switch (metricName) {
      case 'total_usd_value':
        return metrics.total_usd_value;
      case 'daily_pnl_pct':
        return metrics.daily_pnl_pct;
      case 'stablecoin_allocation_pct':
        return metrics.stablecoin_allocation_pct;
      case 'largest_position_pct':
        return metrics.largest_position_pct;
      default:
        return 0;
    }
  }

  evaluateTrigger(metricValue: number, operator: string, targetValue: number): boolean {
    switch (operator) {
      case '<':
        return metricValue < targetValue;
      case '>':
        return metricValue > targetValue;
      case '=':
        return metricValue === targetValue;
      case '<=':
        return metricValue <= targetValue;
      case '>=':
        return metricValue >= targetValue;
      case '!=':
        return metricValue !== targetValue;
      default:
        return false;
    }
  }

  async executeActions(rule: any, actions: any[], metrics: PortfolioMetrics): Promise<void> {
    for (const action of actions) {
      if (action.type === 'ALERT') {
        await this.createAlert(rule, action, metrics);
      }
    }
  }

  async createAlert(rule: any, action: any, metrics: PortfolioMetrics): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO alerts (rule_id, user_id, message, severity)
        VALUES ($1, $2, $3, $4)
      `, [
        rule.id,
        rule.user_id,
        action.message,
        action.severity || 'medium'
      ]);

      logger.info(`Created alert for rule ${rule.name}: ${action.message}`);
    } catch (error) {
      logger.error(`Error creating alert for rule ${rule.name}:`, error);
    }
  }
}

// Initialize and start the rules engine
const rulesEngine = new RulesEngine();

// Run every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  await rulesEngine.evaluateAllRules();
});

logger.info('Rules engine started - evaluating every 30 seconds');

// Keep the process running
process.on('SIGINT', () => {
  logger.info('Rules engine shutting down...');
  process.exit(0);
});
