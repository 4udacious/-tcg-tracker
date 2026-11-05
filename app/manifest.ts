import type { MetadataRoute } from 'next'

/**
 * The web app manifest: what a phone uses when a member adds TCG Tracker to
 * their home screen. With it, Android's "Install app" opens the app on its own
 * (no address bar or tabs) instead of a plain Chrome shortcut, with our icon
 * and name. iPhones read the apple-icon and appleWebApp settings in the root
 * layout. Served at /manifest.webmanifest, which proxy.ts lets through without
 * a sign-in (browsers fetch it without cookies).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TCG Tracker',
    short_name: 'TCG Tracker',
    description: 'Community restock tracker for Pokémon TCG hunters',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1726',
    theme_color: '#0E1726',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
