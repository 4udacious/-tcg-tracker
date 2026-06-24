// Pure helpers for the timers feature, extracted so the minute-stepper wraparound
// and the recent-list area filter are unit-testable without a Supabase mock.

/**
 * Advance a minute mark by `delta`, wrapping within [0, 59].
 * Unifies the +1 / +10 / −1 / −10 steppers, including going below 0
 * (e.g. wrapMinute(0, -1) === 59) and above 59 (wrapMinute(55, 10) === 5).
 */
export function wrapMinute(current: number, delta: number): number {
  return (((current + delta) % 60) + 60) % 60
}

export interface AreaScoped {
  machines: { area: string } | null
}

/**
 * Scope a list of reports to a single area. An empty area string means
 * "all areas" (no filtering). Reports whose machine is null are excluded
 * when an area is selected, since their area is unknown.
 */
export function filterReportsByArea<T extends AreaScoped>(reports: T[], area: string): T[] {
  return area ? reports.filter(r => r.machines?.area === area) : reports
}
