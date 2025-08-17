import express from 'express';
import { supabase } from '../../lib/supabase';
import { getUserId } from '../../lib/session';
import { Alert } from '@/shared/types';

export const alertRoutes = express.Router();

// Get all alerts for a user
alertRoutes.get('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const acknowledged = req.query.acknowledged as string;

    let supabaseQuery = supabase
      .from('alerts')
      .select(`
        *,
        rules!inner(
          name,
          description
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (acknowledged !== undefined) {
      supabaseQuery = supabaseQuery.eq('acknowledged', acknowledged === 'true');
    }

    const { data, error } = await supabaseQuery;
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge an alert
alertRoutes.patch('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;

    const { data, error } = await supabase
      .from('alerts')
      .update({ acknowledged: true })
      .eq('id', alertId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Acknowledge all alerts for a user
alertRoutes.patch('/acknowledge-all', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('alerts')
      .update({ acknowledged: true })
      .eq('user_id', userId)
      .eq('acknowledged', false)
      .select();

    if (error) throw error;
    res.json({ acknowledged_count: data?.length || 0 });
  } catch (error) {
    console.error('Error acknowledging all alerts:', error);
    res.status(500).json({ error: 'Failed to acknowledge all alerts' });
  }
});

// Delete an alert
alertRoutes.delete('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;

    const { data, error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId)
      .select();

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get alert statistics
alertRoutes.get('/stats', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all alerts for the user
    const { data: allAlerts, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const stats = {
      total_alerts: allAlerts?.length || 0,
      unacknowledged_alerts: allAlerts?.filter(a => !a.acknowledged).length || 0,
      high_severity_alerts: allAlerts?.filter(a => a.severity === 'high').length || 0,
      alerts_last_24h: allAlerts?.filter(a => new Date(a.created_at) >= yesterday).length || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching alert statistics:', error);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
});
