import express from 'express';
import pool from '../../database/connection';
import { Alert } from '@/shared/types';

export const alertRoutes = express.Router();

// Get all alerts for a user
alertRoutes.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const acknowledged = req.query.acknowledged as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let query = `
      SELECT 
        a.*,
        r.name as rule_name,
        r.description as rule_description
      FROM alerts a
      JOIN rules r ON a.rule_id = r.id
      WHERE a.user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (acknowledged !== undefined) {
      query += ` AND a.acknowledged = $2`;
      params.push(acknowledged === 'true');
    }
    
    query += ` ORDER BY a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge an alert
alertRoutes.patch('/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;

    const result = await pool.query(
      'UPDATE alerts SET acknowledged = true WHERE id = $1 RETURNING *',
      [alertId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Acknowledge all alerts for a user
alertRoutes.patch('/acknowledge-all', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(
      'UPDATE alerts SET acknowledged = true WHERE user_id = $1 AND acknowledged = false RETURNING count(*)',
      [userId]
    );

    res.json({ acknowledged_count: result.rowCount });
  } catch (error) {
    console.error('Error acknowledging all alerts:', error);
    res.status(500).json({ error: 'Failed to acknowledge all alerts' });
  }
});

// Delete an alert
alertRoutes.delete('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;

    const result = await pool.query(
      'DELETE FROM alerts WHERE id = $1 RETURNING *',
      [alertId]
    );

    if (result.rows.length === 0) {
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
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN acknowledged = false THEN 1 END) as unacknowledged_alerts,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_alerts,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_last_24h
      FROM alerts 
      WHERE user_id = $1
    `, [userId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching alert statistics:', error);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
});
