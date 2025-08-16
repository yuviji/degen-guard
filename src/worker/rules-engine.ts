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
    // Get total portfolio value
    const totalValueResult = await pool.query(`
      SELECT 
        COALESCE(SUM(a.usd_value), 0) as total_usd_value
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '1 hour'
    `, [userId]);

    // Get stablecoin allocation
    const stablecoinResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN a.token_symbol IN ('USDC', 'USDT', 'DAI', 'BUSD', 'FRAX') THEN a.usd_value ELSE 0 END), 0) as stablecoin_value,
        COALESCE(SUM(a.usd_value), 0) as total_value
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '1 hour'
    `, [userId]);

    // Get largest position
    const largestPositionResult = await pool.query(`
      SELECT 
        MAX(
          CASE 
            WHEN SUM(SUM(a.usd_value)) OVER() > 0 THEN 
              (SUM(a.usd_value) / SUM(SUM(a.usd_value)) OVER()) * 100
            ELSE 0 
          END
        ) as largest_position_pct
      FROM wallets w
      JOIN asset_snapshots a ON w.id = a.wallet_id
      WHERE w.user_id = $1 
        AND a.timestamp >= NOW() - INTERVAL '1 hour'
      GROUP BY a.token_symbol
    `, [userId]);

    // Calculate daily PnL (simplified)
    const dailyPnlResult = await pool.query(`
      SELECT 
        COALESCE(
          (current_total.total_value - prev_total.total_value) / NULLIF(prev_total.total_value, 0) * 100,
          0
        ) as daily_pnl_pct
      FROM (
        SELECT SUM(a.usd_value) as total_value
        FROM wallets w
        JOIN asset_snapshots a ON w.id = a.wallet_id
        WHERE w.user_id = $1 
          AND a.timestamp >= NOW() - INTERVAL '1 hour'
      ) current_total
      CROSS JOIN (
        SELECT COALESCE(SUM(a.usd_value), 0) as total_value
        FROM wallets w
        JOIN asset_snapshots a ON w.id = a.wallet_id
        WHERE w.user_id = $1 
          AND a.timestamp >= NOW() - INTERVAL '25 hours'
          AND a.timestamp < NOW() - INTERVAL '23 hours'
      ) prev_total
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
