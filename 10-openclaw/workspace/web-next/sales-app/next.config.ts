import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/sales-api/:path*",
        destination: "http://127.0.0.1:8001/internal/sales/:path*",
      },
    ];
  },
};

export default nextConfig;
