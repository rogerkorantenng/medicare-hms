/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The AI SDK is server-only. Keeping it external stops any chance of the
    // bundler pulling it, or the key it reads, toward the client.
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
};
export default nextConfig;
