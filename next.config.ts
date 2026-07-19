import type { NextConfig } from "next";

// Baseline security headers applied to every response. A full CSP with nonces is
// deliberately out of scope here — Tailwind v4's inline styles and Next dev's
// injected scripts make CSP fragile without a nonce pipeline. Ship separately.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Do not leak framework identity via the X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apply to every route.
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
