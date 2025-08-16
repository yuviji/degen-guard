'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthGuard } from '@/components/auth-guard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasWallets, setHasWallets] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user already has wallets
    const checkWallets = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/wallets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const wallets = await response.json();
          if (wallets.length > 0) {
            setHasWallets(true);
            router.push('/dashboard');
          }
        }
      } catch (err) {
        console.error('Error checking wallets:', err);
      }
    };

    checkWallets();
  }, [router]);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/wallets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: walletAddress,
          chain,
          label: walletLabel || 'My Wallet',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add wallet');
      }

      // Success - move to next step or dashboard
      if (step === 1) {
        setStep(2);
      } else {
        router.push('/dashboard');
      }
      
      // Reset form
      setWalletAddress('');
      setWalletLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const skipToNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      router.push('/dashboard');
    }
  };

  if (hasWallets) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {step === 1 ? 'Welcome to DegenGuard!' : 'Add More Wallets'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 1 
                ? 'Let\'s start by adding your first wallet to monitor'
                : 'Add additional wallets to get a complete view of your portfolio'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddWallet} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="label">Wallet Label (Optional)</Label>
                <Input
                  id="label"
                  type="text"
                  placeholder="My Main Wallet"
                  value={walletLabel}
                  onChange={(e) => setWalletLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chain">Blockchain</Label>
                <select
                  id="chain"
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="optimism">Optimism</option>
                  <option value="base">Base</option>
                </select>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-2">
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Wallet'}
                </Button>
                
                {step === 2 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={skipToNext}
                    disabled={loading}
                  >
                    Skip
                  </Button>
                )}
              </div>
            </form>

            {step === 1 && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={skipToNext}
                  className="text-sm text-gray-600 hover:text-gray-500"
                >
                  Skip for now
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="mt-6 text-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="w-full"
                >
                  Continue to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
