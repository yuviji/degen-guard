import express from 'express';
import { supabase } from '../../lib/supabase';
import { getUserId } from '../../lib/session';
import { Rule, RuleDefinition } from '@/shared/types';

export const ruleRoutes = express.Router();

// Get all rules for a user
ruleRoutes.get('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// Create a rule from natural language
ruleRoutes.post('/from-language', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { naturalLanguage, name } = req.body;

    if (!naturalLanguage) {
      return res.status(400).json({ error: 'Natural language is required' });
    }

    // For now, create a simple rule structure
    // TODO: Implement AI service for natural language processing
    const ruleJson = {
      triggers: [{ metric: 'portfolio_value', operator: '>', value: 0, timeframe: '1h' }],
      actions: [{ type: 'alert', config: { message: naturalLanguage } }]
    };
    
    const description = `Rule created from: ${naturalLanguage}`;

    // Store the rule
    const { data, error } = await supabase
      .from('rules')
      .insert({
        user_id: userId,
        name: name || 'Auto-generated rule',
        description: description,
        rule_json: ruleJson
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating rule from language:', error);
    res.status(500).json({ error: 'Failed to create rule from natural language' });
  }
});

// Create a rule directly with JSON
ruleRoutes.post('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, description, ruleJson } = req.body;

    if (!name || !ruleJson) {
      return res.status(400).json({ error: 'Name and rule JSON are required' });
    }

    // Basic validation of rule JSON structure
    const rule = ruleJson as RuleDefinition;
    if (!rule.triggers || !Array.isArray(rule.triggers) || rule.triggers.length === 0) {
      return res.status(400).json({ error: 'Rule must have at least one trigger' });
    }

    const { data, error } = await supabase
      .from('rules')
      .insert({
        user_id: userId,
        name: name,
        description: description,
        rule_json: ruleJson
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
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

    const { data, error } = await supabase
      .from('rules')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(data);
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

    const { data, error } = await supabase
      .from('rule_evaluations')
      .select('*')
      .eq('rule_id', ruleId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching rule evaluations:', error);
    res.status(500).json({ error: 'Failed to fetch rule evaluations' });
  }
});

// Delete a rule
ruleRoutes.delete('/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    const { data, error } = await supabase
      .from('rules')
      .delete()
      .eq('id', ruleId)
      .select();

    if (error || !data || data.length === 0) {
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

    const { data, error } = await supabase
      .from('rules')
      .select('rule_json')
      .eq('id', ruleId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const ruleJson = data.rule_json as RuleDefinition;
    const explanation = `This rule monitors ${ruleJson.triggers.map((t: any) => t.metric).join(', ')} and triggers alerts when conditions are met.`;

    res.json({ explanation });
  } catch (error) {
    console.error('Error explaining rule:', error);
    res.status(500).json({ error: 'Failed to explain rule' });
  }
});
