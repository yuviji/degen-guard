"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Wallet } from 'lucide-react';
import { FundButton } from '@coinbase/onchainkit/fund';
import { OnchainKitProvider } from '@coinbase/onchainkit';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BuyQuoteResponse {
  onramp_url: string;
  payment_total: {
    currency: string;
    value: string;
  };
  purchase_amount: {
    currency: string;
    value: string;
  };
  coinbase_fee: {
    currency: string;
    value: string;
  };
  network_fee: {
    currency: string;
    value: string;
  };
}

interface WalletInfo {
  address: string;
  balance: string;
  status: string;
}

export default function FundPage() {
  const router = useRouter();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [funded, setFunded] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'ETH'>('USD');
  const [quote, setQuote] = useState<BuyQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [fundingUrl, setFundingUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const fetchWalletInfo = async () => {
      try {
        const walletRes = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const walletData = await walletRes.json();
        console.log("WALLET DATA:", walletData);

        if (walletRes.ok && walletData.address) {
          setWalletInfo(walletData);
          if (parseFloat(walletData.balance) > 0) {
            setFunded(true);
            setTimeout(() => router.push('/dashboard'), 2000);
          }
        }
      } catch (err) {
        console.error('Error fetching wallet:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletInfo();

    const pollForFunding = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        if (parseFloat(data.balance) > 0 && !funded) {
          setFunded(true);
          setWalletInfo(data);
          clearInterval(pollInterval);
          setTimeout(() => router.push('/dashboard'), 2000);
        }
      } catch (err) {
        console.error('Error polling wallet balance:', err);
      }
    };

    const pollInterval = setInterval(pollForFunding, 10000);

    // Cleanup polling on unmount
    return () => clearInterval(pollInterval);
  }, [router, funded]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (funded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Funding Successful!</h2>
            <p className="text-slate-300 mb-4">
              Your wallet has been funded successfully.
            </p>
            <p className="text-sm text-slate-400">
              Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">Fund Your Guardian</CardTitle>
          <CardDescription className="text-slate-300">
            Add funds to your secure wallet to start protecting your DeFi positions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {walletInfo && (
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Wallet Address</span>
                <Badge variant="outline" className="text-xs">
                  <Wallet className="h-4 w-4 mr-1" />
                  Ready to Fund
                </Badge>
              </div>
              <p className="text-xs font-mono text-slate-400 break-all">
                {walletInfo.address}
              </p>
              <div className="mt-2 flex justify-between">
                <span className="text-sm text-slate-300">Current Balance</span>
                <span className="text-sm font-semibold text-white">
                  {parseFloat(walletInfo.balance).toFixed(4)} ETH
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Custom Amount Input */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    currency === 'USD'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  USD
                </button>
                <button
                  onClick={() => setCurrency('ETH')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    currency === 'ETH'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  ETH
                </button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Amount ({currency})
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Enter ${currency} amount`}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  step={currency === 'USD' ? '1' : '0.001'}
                />
              </div>
              
              <button
                onClick={async () => {
                  if (!amount || parseFloat(amount) <= 0) return;
                  
                  setQuoteLoading(true);
                  try {
                    const token = localStorage.getItem('authToken');
                    const response = await fetch(`${API_BASE_URL}/api/onramp/buy-quote`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        paymentAmount: amount,
                        paymentCurrency: currency === 'USD' ? 'USD' : 'ETH',
                        purchaseCurrency: 'ETH',
                        purchaseNetwork: 'base',
                        country: 'US'
                      })
                    });
                    
                    const data = await response.json();
                    if (response.ok) {
                      setQuote(data);
                      setFundingUrl(data.onrampUrl);
                    } else {
                      console.error('Quote error:', data);
                    }
                  } catch (err) {
                    console.error('Error getting quote:', err);
                  } finally {
                    setQuoteLoading(false);
                  }
                }}
                disabled={!amount || parseFloat(amount) <= 0 || quoteLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {quoteLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  'Get Quote'
                )}
              </button>
            </div>
            
            {/* Quote Display */}
            {quote && (
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                <h3 className="text-white font-medium">Quote Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">You'll receive:</span>
                    <span className="text-white font-medium">
                      {parseFloat(quote.purchase_amount.value).toFixed(4)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Total cost:</span>
                    <span className="text-white font-medium">
                      ${parseFloat(quote.payment_total.value).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Coinbase fee:</span>
                    <span className="text-slate-400">
                      ${parseFloat(quote.coinbase_fee.value).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Network fee:</span>
                    <span className="text-slate-400">
                      ${parseFloat(quote.network_fee.value).toFixed(2)}
                    </span>
                  </div>
                </div>
                <FundButton fundingUrl={quote.onramp_url + "&redirectUrl=" + API_BASE_URL} />
              </div>
            )}
            
            {/* Fund Button */}
            {fundingUrl && (
              <FundButton fundingUrl={fundingUrl} />
            )}

            <div className="text-center">
              <p className="text-xs text-slate-400">
                Funds will be automatically detected once the transaction is confirmed on the Base network.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
