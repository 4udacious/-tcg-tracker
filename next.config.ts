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
    // Location is ours only (Timers' "Near me"); no frame or other site gets it.
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
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
      {
        // The battle game is a static page that /play shows in a frame, so our
        // own pages may frame it. Comes after the rule above, so it wins.
        source: "/rpg/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
