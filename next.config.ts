import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Turbopack walks up the
  // tree and mis-selects a stray lockfile in the home dir as the root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
