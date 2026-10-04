/**
 * Token amounts carry cents now.
 *
 * Postgres `numeric` reaches the client as a string often enough that every
 * amount coming out of an RPC goes through `num()` before it is compared or
 * arithmetic is done on it - "9.50" < 10 is true by luck, "9.50" + 1 is
 * "9.501" by the same rules.
 */

/** Coerce an amount that may have arrived as a numeric string. */
export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Smallest amount anyone can pay, list or bid. */
export const CENT = 0.01

/**
 * "12", "12.50", "0.05" - trailing zeroes only when there are cents to show,
 * so whole amounts stay as uncluttered as they were before decimals existed.
 */
export function fmt(v: unknown): string {
  const n = num(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Rounds to the cent, avoiding the usual float drift on x.xx5. */
export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** What a seller keeps after the market's cut. */
export function takeHome(price: number, feePercent: number): number {
  return money(price - money(price * feePercent / 100))
}
