import { describe, it, expect } from 'vitest'
import { wrapMinute, filterReportsByArea, type AreaScoped } from './utils'

describe('wrapMinute', () => {
  it('wraps below 0 back to the top of the minute (…59, 58, 57)', () => {
    expect(wrapMinute(0, -1)).toBe(59)
    expect(wrapMinute(0, -2)).toBe(58)
    expect(wrapMinute(0, -10)).toBe(50)
    expect(wrapMinute(5, -10)).toBe(55)
  })

  it('wraps above 59 back to the start', () => {
    expect(wrapMinute(59, 1)).toBe(0)
    expect(wrapMinute(55, 10)).toBe(5)
  })

  it('steps within range without wrapping', () => {
    expect(wrapMinute(30, 10)).toBe(40)
    expect(wrapMinute(30, -10)).toBe(20)
    expect(wrapMinute(30, 1)).toBe(31)
    expect(wrapMinute(30, -1)).toBe(29)
  })
})

describe('filterReportsByArea', () => {
  const reports: (AreaScoped & { id: string })[] = [
    { id: 'a', machines: { area: 'Perth' } },
    { id: 'b', machines: { area: 'Joondalup' } },
    { id: 'c', machines: { area: 'Perth' } },
    { id: 'd', machines: null },
  ]

  it('returns all reports when no area is selected', () => {
    expect(filterReportsByArea(reports, '')).toHaveLength(4)
  })

  it('returns only reports in the selected area', () => {
    const perth = filterReportsByArea(reports, 'Perth')
    expect(perth.map(r => r.id)).toEqual(['a', 'c'])
  })

  it('excludes reports with an unknown (null) machine when an area is selected', () => {
    expect(filterReportsByArea(reports, 'Joondalup').map(r => r.id)).toEqual(['b'])
  })
})
