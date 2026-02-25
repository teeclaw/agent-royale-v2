/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/legacy/index.html' },
        { source: '/arena', destination: '/legacy/arena.html' },
        { source: '/agent', destination: '/legacy/agent.html' },
        { source: '/dashboard', destination: '/legacy/dashboard.html' },
      ],
    };
  },
};

export default nextConfig;
