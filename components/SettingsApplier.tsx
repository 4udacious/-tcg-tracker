'use client'

import { useEffect } from 'react'
import { useSettings } from '@/lib/settings'

/**
 * Puts the device settings that act on the whole page into effect: Reduce
 * motion becomes `data-motion` on <html> (globals.css does the rest). The
 * same attribute is set before first paint by the root layout's script, so
 * this only has to follow changes.
 */
export default function SettingsApplier() {
  const { reduceMotion } = useSettings()
  useEffect(() => {
    const html = document.documentElement
    if (reduceMotion === 'on') html.setAttribute('data-motion', 'reduce')
    else if (reduceMotion === 'off') html.setAttribute('data-motion', 'full')
    else html.removeAttribute('data-motion')
  }, [reduceMotion])
  return null
}
