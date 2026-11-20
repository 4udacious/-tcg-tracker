/*
 * Shared by the admin VVM page (a server component) and its supplies section
 * (a client component). It lives in a plain module because anything exported
 * from a 'use client' file is a client reference on the server: calling it
 * there throws, and takes the whole page down.
 */

/** A rematch ticket (v89) or a double battle ticket (v109): a supply of its own, shown on the Rematches tab. */
export const isRematch = (s: { key: string }) => s.key.startsWith('rematch_') || isDouble(s)
/** A double battle ticket (v109): two trainers at once, for those who've beaten both. */
export const isDouble = (s: { key: string }) => s.key.startsWith('double_')
