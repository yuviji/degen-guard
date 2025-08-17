"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();

  useEffect(() => {
    const handleRedirect = async () => {
      if (loading) return;
      
      // If no user, redirect to login
      if (!user || !session) {
        router.push('/login');
        return;
      }

      // Check if user has a CDP account to determine redirect
      try {
        const accountResponse = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          if (accountData.exists && accountData.server) {
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        } else if (accountResponse.status === 401) {
          router.push('/login');
        } else {
          // If we can't check account, go to onboarding to be safe
          router.push('/onboarding');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        router.push('/login');
      }
    };

    handleRedirect();
  }, [router, user, session, loading]);

  // Show loading spinner while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading DegenGuard...</p>
      </div>
    </div>
  );
}
