"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      const token = localStorage.getItem('authToken');
      
      // If no token, redirect to login
      if (!token) {
        router.push('/login');
        return;
      }

      // Verify token is valid
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        
        if (isExpired) {
          localStorage.removeItem('authToken');
          router.push('/login');
          return;
        }

        // Check if user has wallets
        const walletsResponse = await fetch(`${API_BASE_URL}/api/wallets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (walletsResponse.ok) {
          const wallets = await walletsResponse.json();
          if (wallets.length > 0) {
            router.push('/dashboard');
          } else {
            router.push('/onboarding');
          }
        } else if (walletsResponse.status === 401) {
          localStorage.removeItem('authToken');
          router.push('/login');
        } else {
          // If we can't check wallets, go to onboarding to be safe
          router.push('/onboarding');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('authToken');
        router.push('/login');
      }
    };

    handleRedirect();
  }, [router]);

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
