import express from 'express';
import { getUserId } from '../../lib/session';
import { getServerWallet } from '../../lib/cdp';
import { 
  setupPortfolioWebhooks, 
  processWebhookEvent, 
  verifyWebhookSignature,
  WebhookEvent 
} from '../../lib/cdp-webhooks';

export const webhookRoutes = express.Router();

/**
 * Setup webhooks for a user's portfolio monitoring
 */
webhookRoutes.post('/setup', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's server wallet address
    const serverWallet = await getServerWallet(Number(userId));
    if (!serverWallet) {
      return res.status(404).json({ error: 'No server wallet found for user' });
    }

    // Setup webhooks for portfolio monitoring
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
    const webhooks = await setupPortfolioWebhooks(
      serverWallet.address,
      webhookBaseUrl
    );

    res.json({
      message: 'Portfolio webhooks setup successfully',
      webhooks
    });
  } catch (error) {
    console.error('Error setting up webhooks:', error);
    res.status(500).json({ error: 'Failed to setup webhooks' });
  }
});

/**
 * Receive webhook events from CDP
 */
webhookRoutes.post('/portfolio', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-cdp-webhook-signature'] as string;
    const payload = req.body.toString();

    // Verify webhook signature for security
    const webhookSecret = process.env.CDP_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(payload, signature, webhookSecret);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Parse webhook event
    const event: WebhookEvent = JSON.parse(payload);
    
    // Process the webhook event
    processWebhookEvent(event);

    // TODO: Implement specific portfolio update logic
    // - Update cached portfolio data
    // - Trigger real-time UI updates via WebSocket
    // - Check for risk alerts
    // - Store transaction for analysis

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Get webhook status and configuration
 */
webhookRoutes.get('/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Implement webhook status checking
    // - List active webhooks for user
    // - Show webhook health/activity
    // - Display recent events

    res.json({
      message: 'Webhook status endpoint - implementation pending',
      webhooks: []
    });
  } catch (error) {
    console.error('Error fetching webhook status:', error);
    res.status(500).json({ error: 'Failed to fetch webhook status' });
  }
});
