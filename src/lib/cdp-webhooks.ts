import { CdpClient } from "@coinbase/cdp-sdk";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
  throw new Error("Missing CDP_API_KEY_ID/CDP_API_KEY_SECRET environment variables");
}

// Create CDP client instance for webhook operations
export const cdpWebhooks = new CdpClient();

export interface WebhookConfig {
  id?: string;
  url: string;
  eventTypes: WebhookEventType[];
  addresses: string[];
  network: string;
}

export type WebhookEventType = 
  | 'wallet_activity'
  | 'smart_contract_activity'
  | 'erc20_transfer'
  | 'erc721_transfer'
  | 'erc1155_transfer_single'
  | 'erc1155_transfer_batch'
  | 'transaction';

export interface WebhookEvent {
  webhookId: string;
  eventType: WebhookEventType;
  network: string;
  projectName: string;
  blockTime: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex?: number;
  from: string;
  to: string;
  value: string;
  // Additional fields for specific event types
  contractAddress?: string;
  tokenId?: string;
  tokenAddress?: string;
  amount?: string;
}

/**
 * Create a webhook for wallet activity monitoring using REST API
 */
export async function createWalletWebhook(
  webhookUrl: string,
  addresses: string[],
  network: string = 'base-mainnet'
): Promise<string> {
  try {
    const response = await fetch('https://api.cdp.coinbase.com/platform/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_KEY_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        event_type: 'wallet_activity',
        event_filters: {
          addresses: addresses,
        },
        network_id: network,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook creation failed: ${response.statusText}`);
    }

    const webhook = await response.json();
    console.log(`Created wallet webhook: ${webhook.id}`);
    return webhook.id;
  } catch (error) {
    console.error('Error creating wallet webhook:', error);
    throw error;
  }
}

/**
 * Create a webhook for smart contract activity monitoring using REST API
 */
export async function createSmartContractWebhook(
  webhookUrl: string,
  contractAddresses: string[],
  network: string = 'base-mainnet'
): Promise<string> {
  try {
    const response = await fetch('https://api.cdp.coinbase.com/platform/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_KEY_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        event_type: 'smart_contract_activity',
        event_filters: {
          addresses: contractAddresses,
        },
        network_id: network,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook creation failed: ${response.statusText}`);
    }

    const webhook = await response.json();
    console.log(`Created smart contract webhook: ${webhook.id}`);
    return webhook.id;
  } catch (error) {
    console.error('Error creating smart contract webhook:', error);
    throw error;
  }
}

/**
 * List all webhooks for the current project using REST API
 */
export async function listWebhooks(): Promise<any[]> {
  try {
    const response = await fetch('https://api.cdp.coinbase.com/platform/v1/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_KEY_ID}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list webhooks: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error listing webhooks:', error);
    throw error;
  }
}

/**
 * Update an existing webhook using REST API
 */
export async function updateWebhook(
  webhookId: string,
  updates: Partial<WebhookConfig>
): Promise<void> {
  try {
    const response = await fetch(`https://api.cdp.coinbase.com/platform/v1/webhooks/${webhookId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_KEY_ID}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Failed to update webhook: ${response.statusText}`);
    }

    console.log(`Updated webhook: ${webhookId}`);
  } catch (error) {
    console.error('Error updating webhook:', error);
    throw error;
  }
}

/**
 * Delete a webhook using REST API
 */
export async function deleteWebhook(webhookId: string): Promise<void> {
  try {
    const response = await fetch(`https://api.cdp.coinbase.com/platform/v1/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.CDP_API_KEY_ID}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete webhook: ${response.statusText}`);
    }

    console.log(`Deleted webhook: ${webhookId}`);
  } catch (error) {
    console.error('Error deleting webhook:', error);
    throw error;
  }
}

/**
 * Verify webhook signature for security
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Process incoming webhook events
 */
export function processWebhookEvent(event: WebhookEvent): void {
  console.log(`Processing webhook event: ${event.eventType}`);
  console.log(`Transaction: ${event.transactionHash}`);
  console.log(`From: ${event.from} To: ${event.to}`);
  console.log(`Value: ${event.value}`);

  // TODO: Implement event processing logic
  // - Update portfolio cache
  // - Trigger alerts/notifications
  // - Store transaction data
  // - Update risk assessments
}

/**
 * Setup portfolio monitoring webhooks for a user
 */
export async function setupPortfolioWebhooks(
  userAddress: string,
  webhookBaseUrl: string
): Promise<{ walletWebhookId: string }> {
  try {
    // Create webhook URL for this user
    const webhookUrl = `${webhookBaseUrl}/api/webhooks/portfolio`;

    // Create wallet activity webhook
    const walletWebhookId = await createWalletWebhook(
      webhookUrl,
      [userAddress],
      'base-mainnet'
    );

    console.log(`Setup portfolio webhooks for ${userAddress}`);
    return { walletWebhookId };
  } catch (error) {
    console.error('Error setting up portfolio webhooks:', error);
    throw error;
  }
}
