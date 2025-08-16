'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthGuard } from '@/components/auth-guard';
import { FundingFlow } from '@/components/funding-flow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function OnboardingPage() {
  const [step, setStep] = useState<'account' | 'funding' | 'complete'>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasAccount, setHasAccount] = useState(false);
  const [accountAddress, setAccountAddress] = useState('');
  const router = useRouter();

  const checkFundingStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/funding/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.is_funded) {
          router.push('/dashboard');
        } else if (data.has_account) {
          setStep('funding');
        }
      }
    } catch (err) {
      console.error('Error checking funding status:', err);
    }
  };

  useEffect(() => {
    // Check if user already has a CDP account
    const checkAccount = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.exists && data.server) {
            setHasAccount(true);
            setAccountAddress(data.server.address);
            // Check funding status
            checkFundingStatus();
          }
        }
      } catch (err) {
        console.error('Error checking account:', err);
      }
    };

    checkAccount();
  }, [router]);

  const handleProvisionAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/cdp/provision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to provision account');
      }

      // Success - move to funding step
      setAccountAddress(data.address);
      setHasAccount(true);
      setStep('funding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFundingComplete = () => {
    setStep('complete');
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  };

  if (hasAccount && step === 'account') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        {step === 'account' && (
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                Welcome to DegenGuard!
              </CardTitle>
              <CardDescription className="text-center">
                Let's create your secure account to start monitoring your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProvisionAccount} className="space-y-4">
                <div className="space-y-4 text-center">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">Secure Account Creation</h3>
                    <p className="text-sm text-blue-700">
                      We'll create a secure server-managed account for you using Coinbase Developer Platform. 
                      This account will be used to monitor and analyze your portfolio safely.
                    </p>
                  </div>
                </div>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Secure Account'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'funding' && (
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Fund Your Account</h1>
              <p className="text-gray-600 mt-2">
                Add crypto to your account using your Coinbase balance or debit card
              </p>
            </div>
            <FundingFlow onFundingComplete={handleFundingComplete} showTitle={false} />
          </div>
        )}

        {step === 'complete' && (
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center text-green-600">
                Setup Complete!
              </CardTitle>
              <CardDescription className="text-center">
                Your account has been created and funded. Redirecting to dashboard...
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthGuard>
  );
}
