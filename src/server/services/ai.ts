import { GoogleGenerativeAI } from '@google/generative-ai';
import { RuleDefinition } from '@/shared/types';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const RuleSchema = z.object({
  triggers: z.array(z.object({
    metric: z.string(),
    op: z.enum(['<', '>', '=', '<=', '>=', '!=']),
    value: z.number()
  })),
  logic: z.enum(['ALL', 'ANY']),
  scope: z.object({
    wallet_ids: z.array(z.string()).optional(),
    chains: z.array(z.string()).optional()
  }).optional(),
  actions: z.array(z.object({
    type: z.literal('ALERT'),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high']).optional()
  }))
});

class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  }

  async convertNaturalLanguageToRule(naturalLanguage: string): Promise<RuleDefinition> {
    const systemPrompt = `You are a compiler that converts natural language into JSON rule schemas for DeFi portfolio monitoring.

Available metrics:
- total_usd_value: Total portfolio value in USD
- daily_pnl_pct: Daily profit/loss percentage
- stablecoin_allocation_pct: Percentage of portfolio in stablecoins
- largest_position_pct: Percentage of largest single token position

Available operators: <, >, =, <=, >=, !=
Available logic: ALL (all triggers must be true), ANY (any trigger can be true)
Available actions: ALERT with message and optional severity (low, medium, high)

Examples:
"Alert me if my daily PnL is less than -5%" ->
{
  "triggers": [{"metric": "daily_pnl_pct", "op": "<", "value": -5}],
  "logic": "ANY",
  "actions": [{"type": "ALERT", "message": "Daily PnL below -5%", "severity": "high"}]
}

"Tell me if stablecoins are less than 30% of my portfolio" ->
{
  "triggers": [{"metric": "stablecoin_allocation_pct", "op": "<", "value": 30}],
  "logic": "ANY", 
  "actions": [{"type": "ALERT", "message": "Stablecoin allocation below 30%", "severity": "medium"}]
}

Convert the following natural language to JSON rule schema. Return ONLY the JSON, no explanation:`;

    try {
      const prompt = `${systemPrompt}\n\nUser input: ${naturalLanguage}`;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No response from Gemini');
      }

      // Extract JSON from response (Gemini might include extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      // Parse and validate the JSON
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = RuleSchema.parse(parsed);
      
      return validated;
    } catch (error) {
      console.error('Error converting natural language to rule:', error);
      throw new Error('Failed to convert natural language to rule');
    }
  }

  async explainRule(rule: RuleDefinition): Promise<string> {
    const systemPrompt = `You are an assistant that explains DeFi portfolio monitoring rules in plain English.

Given a JSON rule schema, explain what it does in simple, clear language.

Example:
Rule: {"triggers": [{"metric": "daily_pnl_pct", "op": "<", "value": -5}], "logic": "ANY", "actions": [{"type": "ALERT", "message": "Daily PnL below -5%"}]}
Explanation: "This rule will alert you when your daily profit/loss drops below -5%."

Explain the following rule in one clear sentence:`;

    try {
      const prompt = `${systemPrompt}\n\nRule: ${JSON.stringify(rule)}`;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      return content || 'Unable to explain rule';
    } catch (error) {
      console.error('Error explaining rule:', error);
      return 'Unable to explain rule';
    }
  }

  validateMetric(metric: string): boolean {
    const validMetrics = [
      'total_usd_value',
      'daily_pnl_pct', 
      'stablecoin_allocation_pct',
      'largest_position_pct'
    ];
    return validMetrics.includes(metric);
  }
}

export default new AIService();
