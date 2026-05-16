/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Privy pulls in optional Farcaster/Solana adapters we don't use.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@farcaster/mini-app-solana': false,
    };
    return config;
  },
};

export default nextConfig;
