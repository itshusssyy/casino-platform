import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: almost every page here is per-user and
  // shows a live coin balance, so request-time rendering is what we want.
  cacheComponents: false,
  // Hide the floating Next.js "N" developer badge (it only ever shows in local development).
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
