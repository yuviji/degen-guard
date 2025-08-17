'use client';

import type { ReactNode } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

if (!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY) {
  throw new Error('NEXT_PUBLIC_ONCHAINKIT_API_KEY is not defined');
}

if (!process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_ID) {
  throw new Error('NEXT_PUBLIC_ONCHAINKIT_PROJECT_ID is not defined');
}

const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'DegenGuard',
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={base}
          projectId={process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_ID}
        >
          {props.children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
