'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FundingQuote {
  id: string;
  amount_usd: string;
  asset: string;
  network: string;
  estimated_amount: string;
  fees: {
    coinbase_fee: string;
    network_fee: string;
    total_fee: string;
  };
  expires_at: string;
}

interface FundingOperation {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount_usd: number;
  asset: string;
  error_message?: string;
  created_at: string;
}

interface FundingFlowProps {
  onFundingComplete?: () => void;
  showTitle?: boolean;
}

export function FundingFlow({ onFundingComplete, showTitle = true }: FundingFlowProps) {
  const [step, setStep] = useState<'amount' | 'quote' | 'confirm' | 'processing' | 'complete'>('amount');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<'USDC' | 'ETH'>('USDC');
  const [quote, setQuote] = useState<FundingQuote | null>(null);
  const [operation, setOperation] = useState<FundingOperation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/funding/quote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount_usd: amount,
          asset,
          network: 'base'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get quote');
      }

      setQuote(data);
      setStep('quote');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const executeFunding = async () => {
    if (!quote) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/funding/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quote_id: quote.id,
          amount_usd: quote.amount_usd,
          asset: quote.asset,
          network: quote.network
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute funding');
      }

      setOperation(data);
      setStep('processing');
      
      // Poll for completion
      pollOperationStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute funding');
    } finally {
      setLoading(false);
    }
  };

  const pollOperationStatus = async (operationId: string) => {
    const maxAttempts = 30; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/funding/operations/${operationId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setOperation(data);

          if (data.status === 'completed') {
            setStep('complete');
            onFundingComplete?.();
            return;
          } else if (data.status === 'failed') {
            setError(data.error_message || 'Funding failed');
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          setError('Funding is taking longer than expected. Please check back later.');
        }
      } catch (err) {
        console.error('Error polling operation status:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        }
      }
    };

    poll();
  };

  const resetFlow = () => {
    setStep('amount');
    setAmount('');
    setQuote(null);
    setOperation(null);
    setError('');
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Fund Your Account
          </CardTitle>
          <CardDescription>
            Add crypto to your account using your Coinbase balance or debit card
          </CardDescription>
        </CardHeader>
      )}
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'amount' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
                max="10000"
              />
              <p className="text-sm text-gray-500">Minimum: $10, Maximum: $10,000</p>
            </div>

            <div className="space-y-2">
              <Label>Asset to Purchase</Label>
              <div className="flex gap-2">
                <Button
                  variant={asset === 'USDC' ? 'default' : 'outline'}
                  onClick={() => setAsset('USDC')}
                  className="flex-1"
                >
                  USDC
                </Button>
                <Button
                  variant={asset === 'ETH' ? 'default' : 'outline'}
                  onClick={() => setAsset('ETH')}
                  className="flex-1"
                >
                  ETH
                </Button>
              </div>
            </div>

            <Button onClick={getQuote} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Quote...
                </>
              ) : (
                'Get Quote'
              )}
            </Button>
          </div>
        )}

        {step === 'quote' && quote && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-medium">{formatCurrency(quote.amount_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span>You'll receive:</span>
                <span className="font-medium">{quote.estimated_amount} {quote.asset}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Coinbase fee:</span>
                <span>{formatCurrency(quote.fees.coinbase_fee)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Network fee:</span>
                <span>{formatCurrency(quote.fees.network_fee)}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-2">
                <span>Total cost:</span>
                <span>{formatCurrency((parseFloat(quote.amount_usd) + parseFloat(quote.fees.total_fee)).toString())}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
                Back
              </Button>
              <Button onClick={executeFunding} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Confirm Purchase
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && operation && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">Processing Your Purchase</h3>
              <p className="text-sm text-gray-600 mt-1">
                Your {operation.asset} purchase is being processed. This usually takes 1-2 minutes.
              </p>
            </div>
            <Badge variant="secondary">
              Status: {operation.status}
            </Badge>
          </div>
        )}

        {step === 'complete' && operation && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-green-600">Purchase Complete!</h3>
              <p className="text-sm text-gray-600 mt-1">
                Your account has been funded with {operation.asset}.
              </p>
            </div>
            <Button onClick={resetFlow} variant="outline" className="w-full">
              Fund More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
