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
      {
        // The battle game's art and cries (about 900 files, fetched as they're
        // needed) almost never change: kept for a week without the browser
        // asking again, then a day more while it checks in the background.
        // A replaced picture shows within the week.
        source: "/rpg/a/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        // The game's code, as index.html loads it: game.js?v=<the file's hash>.
        // Every update gets a new address, so each one can be kept for good
        // (tests/rpg checks the tag matches the file). index.html itself keeps
        // the default, so an update reaches everyone on their next visit.
        source: "/rpg/game.js",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
