import React, { useEffect, useState } from 'react';

interface ApplePayButtonProps {
  onPurchase: () => void;
  amount: string;
  className?: string;
}

declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments(): boolean;
      new(version: number, paymentRequest: any): any;
    };
  }
  
  const ApplePaySession: {
    canMakePayments(): boolean;
    new(version: number, paymentRequest: any): any;
  } | undefined;
}

export const ApplePayButton: React.FC<ApplePayButtonProps> = ({
  onPurchase,
  amount,
  className = ""
}) => {
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if Apple Pay is available
    if (window.ApplePaySession && window.ApplePaySession.canMakePayments()) {
      setIsApplePayAvailable(true);
    }
  }, []);

  const handleApplePayClick = async () => {
    if (!isApplePayAvailable) {
      // Fallback to regular purchase flow
      onPurchase();
      return;
    }

    setIsLoading(true);
    try {
      // In a real implementation, you would:
      // 1. Create Apple Pay session with merchant validation
      // 2. Handle payment authorization
      // 3. Process payment through your backend
      // For now, we'll simulate the flow and redirect to Coinbase
      
      // Simulate Apple Pay flow
      await new Promise(resolve => setTimeout(resolve, 1000));
      onPurchase();
    } catch (error) {
      console.error('Apple Pay failed:', error);
      // Fallback to regular purchase
      onPurchase();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleApplePayClick}
      disabled={isLoading}
      className={`bg-black hover:bg-gray-800 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 ${className}`}
      style={{
        background: isLoading ? '#666' : 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      }}
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Processing...</span>
        </>
      ) : (
        <>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
          >
            <path
              d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 21.99C7.78997 22.03 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.13997 6.91 8.85997 6.89C10.15 6.87 11.36 7.74 12.1 7.74C12.83 7.74 14.24 6.68 15.73 6.84C16.39 6.87 18.03 7.15 19.05 8.82C18.95 8.89 17.06 10.1 17.08 12.4C17.1 15.24 19.77 16.2 19.8 16.21C19.78 16.28 19.35 17.78 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"
              fill="currentColor"
            />
          </svg>
          <span>
            {isApplePayAvailable ? `Pay $${amount}` : `Buy with Coinbase $${amount}`}
          </span>
        </>
      )}
    </button>
  );
};

// Alternative payment button for non-Apple Pay users
export const PaymentButton: React.FC<ApplePayButtonProps> = ({
  onPurchase,
  amount,
  className = ""
}) => {
  return (
    <button
      onClick={onPurchase}
      className={`bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-white"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          fill="currentColor"
        />
      </svg>
      <span>Continue with Coinbase ${amount}</span>
    </button>
  );
};
