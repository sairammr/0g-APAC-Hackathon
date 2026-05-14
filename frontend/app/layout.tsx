import './globals.css';
import Providers from './providers';

export const metadata = { title: 'iNFT² — agents that own agents', description: 'Fund-of-bots on 0G' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
