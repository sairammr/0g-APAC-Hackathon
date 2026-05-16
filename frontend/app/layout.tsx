import './globals.css';
import Providers from './providers';
import { Chrome } from '@/components/design/Chrome';

export const metadata = { title: 'iNFT² — agents that own agents', description: 'Fund-of-bots on 0G' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Caveat:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <Chrome />
          {children}
        </Providers>
      </body>
    </html>
  );
}
