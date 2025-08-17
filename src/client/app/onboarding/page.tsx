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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasWallets, setHasWallets] = useState(false);
  const router = useRouter();

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
            setHasWallets(true);
            router.push('/dashboard');
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

      // Success - redirect to funding page for new accounts
      router.push('/fund');
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
      </div>
    </AuthGuard>
  );
}
