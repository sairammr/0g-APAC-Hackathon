'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { zg } from '@/lib/chain';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: { theme: 'light', accentColor: '#000000' },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: zg,
        supportedChains: [zg],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
