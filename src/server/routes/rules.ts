import express from 'express';
import pool from '../../database/connection';
import aiService from '../services/ai';
import { Rule, RuleDefinition } from '@/shared/types';

export const ruleRoutes = express.Router();

// Get all rules for a user
ruleRoutes.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(
      'SELECT * FROM rules WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// Create a rule from natural language
ruleRoutes.post('/from-language', async (req, res) => {
  try {
    const { userId, naturalLanguage, name } = req.body;

    if (!userId || !naturalLanguage) {
      return res.status(400).json({ error: 'User ID and natural language are required' });
    }

    // Convert natural language to rule JSON
    const ruleJson = await aiService.convertNaturalLanguageToRule(naturalLanguage);
    
    // Generate explanation
    const description = await aiService.explainRule(ruleJson);

    // Store the rule
    const result = await pool.query(
      `INSERT INTO rules (user_id, name, description, rule_json) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, name || 'Auto-generated rule', description, JSON.stringify(ruleJson)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating rule from language:', error);
    res.status(500).json({ error: 'Failed to create rule from natural language' });
  }
});

// Create a rule directly with JSON
ruleRoutes.post('/', async (req, res) => {
  try {
    const { userId, name, description, ruleJson } = req.body;

    if (!userId || !name || !ruleJson) {
      return res.status(400).json({ error: 'User ID, name, and rule JSON are required' });
    }

    // Validate rule JSON structure
    const rule = ruleJson as RuleDefinition;
    for (const trigger of rule.triggers) {
      if (!aiService.validateMetric(trigger.metric)) {
        return res.status(400).json({ error: `Invalid metric: ${trigger.metric}` });
      }
    }

    const result = await pool.query(
      `INSERT INTO rules (user_id, name, description, rule_json) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, name, description, JSON.stringify(ruleJson)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// Update rule active status
ruleRoutes.patch('/:ruleId/status', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const result = await pool.query(
      'UPDATE rules SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [isActive, ruleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating rule status:', error);
    res.status(500).json({ error: 'Failed to update rule status' });
  }
});

// Get rule evaluations
ruleRoutes.get('/:ruleId/evaluations', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await pool.query(
      'SELECT * FROM rule_evaluations WHERE rule_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [ruleId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rule evaluations:', error);
    res.status(500).json({ error: 'Failed to fetch rule evaluations' });
  }
});

// Delete a rule
ruleRoutes.delete('/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    const result = await pool.query(
      'DELETE FROM rules WHERE id = $1 RETURNING *',
      [ruleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// Explain a rule in natural language
ruleRoutes.post('/:ruleId/explain', async (req, res) => {
  try {
    const { ruleId } = req.params;

    const result = await pool.query(
      'SELECT rule_json FROM rules WHERE id = $1',
      [ruleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const ruleJson = result.rows[0].rule_json as RuleDefinition;
    const explanation = await aiService.explainRule(ruleJson);

    res.json({ explanation });
  } catch (error) {
    console.error('Error explaining rule:', error);
    res.status(500).json({ error: 'Failed to explain rule' });
  }
});
