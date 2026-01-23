/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Required for pdf-parse to work in Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
