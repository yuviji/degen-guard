import * as express from 'express';
import { generateOnRampJwt, generateSessionTokenJwt } from '../../lib/cdp-auth';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

interface BuyQuoteRequest {
  country: string;
  paymentAmount: string;
  paymentCurrency: string;
  paymentMethod?: string;
  purchaseCurrency: string;
  purchaseNetwork: string;
  subdivision?: string;
}

interface BuyQuoteResponse {
  coinbaseFee: {
    currency: string;
    value: string;
  };
  networkFee: {
    currency: string;
    value: string;
  };
  onrampUrl: string;
  paymentSubtotal: {
    currency: string;
    value: string;
  };
  paymentTotal: {
    currency: string;
    value: string;
  };
  purchaseAmount: {
    currency: string;
    value: string;
  };
  quoteId: string;
}

/**
 * Create a buy quote for on-ramping crypto to the user's server wallet
 */
router.post('/buy-quote', authenticateToken, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    
    // Get user's server wallet address
    const { getServerWallet } = await import('../../lib/cdp');
    const serverWallet = await getServerWallet(userId.toString());
    
    if (!serverWallet) {
      return res.status(404).json({ error: 'Server wallet not found' });
    }

    const {
      country = 'US',
      paymentAmount,
      paymentCurrency = 'USD',
      paymentMethod = 'FIAT_WALLET', // Default to Apple Pay for better UX
      purchaseCurrency = 'ETH',
      purchaseNetwork = 'base',
      subdivision = 'CA' // Default to California
    }: BuyQuoteRequest = req.body;

    if (!paymentAmount) {
      return res.status(400).json({ error: 'Payment amount is required' });
    }

    // Generate JWT token for authentication
    const token = await generateOnRampJwt();
    console.log("BUY QUOTE TOKEN:", token)

    // Create buy quote request
    const url = 'https://api.developer.coinbase.com/onramp/v1/buy/quote';
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        country,
        destinationAddress: serverWallet.address,
        paymentAmount,
        paymentCurrency,
        paymentMethod,
        purchaseCurrency,
        purchaseNetwork,
        subdivision
      })
    };

    const response = await fetch(url, options);
    const data: BuyQuoteResponse = await response.json();
    console.log("BUY QUOTE RESPONSE:", data)


    if (!response.ok) {
      console.error('On-ramp quote error:', data);
      return res.status(response.status).json({ 
        error: 'Failed to create buy quote',
        details: data
      });
    }

    // Transform response to match frontend expectations (snake_case)
    const transformedResponse = {
      onramp_url: data.onrampUrl,
      payment_total: {
        currency: data.paymentTotal.currency,
        value: data.paymentTotal.value
      },
      purchase_amount: {
        currency: data.purchaseAmount.currency,
        value: data.purchaseAmount.value
      },
      coinbase_fee: {
        currency: data.coinbaseFee.currency,
        value: data.coinbaseFee.value
      },
      network_fee: {
        currency: data.networkFee.currency,
        value: data.networkFee.value
      },
      quote_id: data.quoteId,
      destination_address: serverWallet.address,
      network: purchaseNetwork,
      currency: purchaseCurrency
    };

    res.json(transformedResponse);

  } catch (error) {
    console.error('Buy quote creation failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get supported countries and payment methods for on-ramp
 */
router.get('/config', authenticateToken, async (req, res) => {
  try {
    // Generate JWT token for authentication
    const token = await generateOnRampJwt();

    // Get supported countries
    const configUrl = 'https://api.developer.coinbase.com/onramp/v1/buy/config';
    const configOptions = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const configResponse = await fetch(configUrl, configOptions);
    const configData = await configResponse.json();

    if (!configResponse.ok) {
      console.error('On-ramp config error:', configData);
      return res.status(configResponse.status).json({ 
        error: 'Failed to get on-ramp configuration',
        details: configData 
      });
    }

    res.json(configData);

  } catch (error) {
    console.error('On-ramp config failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate session token for secure onramp initialization
 */
router.post('/session-token', authenticateToken, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    
    // Get user's server wallet address
    const { getServerWallet } = await import('../../lib/cdp');
    const serverWallet = await getServerWallet(userId.toString());
    
    if (!serverWallet) {
      return res.status(404).json({ error: 'Server wallet not found' });
    }

    // Generate JWT token for CDP API authentication
    const token = await generateSessionTokenJwt();
    console.log("Session Token:", token);

    // Create session token request
    const sessionTokenUrl = 'https://api.developer.coinbase.com/onramp/v1/token';
    const sessionTokenOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        addresses: [
          {
            address: serverWallet.address,
            blockchains: ['base', 'ethereum']
          }
        ],
        assets: ['ETH', 'USDC']
      })
    };

    const sessionResponse = await fetch(sessionTokenUrl, sessionTokenOptions);
    const sessionData = await sessionResponse.json();
    console.log("Session Data:", sessionData);

    if (!sessionResponse.ok) {
      console.error('Session token creation error:', sessionData);
      return res.status(sessionResponse.status).json({ 
        error: 'Failed to create session token',
        details: sessionData 
      });
    }

    // Return the session token
    res.json({
      sessionToken: sessionData.token,
      channelId: sessionData.channelId,
      destinationAddress: serverWallet.address
    });

  } catch (error) {
    console.error('Session token creation failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
