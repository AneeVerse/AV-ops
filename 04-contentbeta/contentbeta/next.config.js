/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development hot-reload chunks separate from production build output.
  // Running `next build` while a dev server is open can otherwise leave the
  // browser requesting chunk names that no longer exist.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: '20mb' },
  },
  webpack: (config) => {
    // pdf-parse uses canvas + encoding as optional deps; stub them out
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    }
    return config
  },
}

module.exports = nextConfig
