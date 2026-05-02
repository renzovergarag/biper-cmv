// apps/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push("bcrypt");
    return config;
  },
};

export default nextConfig;
