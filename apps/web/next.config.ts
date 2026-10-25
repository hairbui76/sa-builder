import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sa/engine', '@sa/content'],
};

export default nextConfig;
