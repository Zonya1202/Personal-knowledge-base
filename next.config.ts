import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Прячем экранный дев-индикатор Next (мешает при тесте на телефоне)
  devIndicators: false,
};

export default nextConfig;
