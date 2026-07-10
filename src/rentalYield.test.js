import { describe, expect, it } from 'vitest'
import { computeGrossYieldPct, getRentalYield } from './rentalYield.js'

describe('getRentalYield', () => {
  it('returns the apartment yield for a condo in a covered community', () => {
    expect(getRentalYield('JVC', 'CONDO')).toBe(7.43)
  })

  it('returns the villa yield for the same community with a different asset class', () => {
    expect(getRentalYield('JVC', 'VILLA')).toBe(4.79)
  })

  it('returns null when that community/asset-class combination is not covered', () => {
    expect(getRentalYield('PALM', 'CONDO')).toBeNull()
    expect(getRentalYield('DOWNTOWN', 'VILLA')).toBeNull()
  })

  it('returns null for an unknown community', () => {
    expect(getRentalYield('NOT_A_COMMUNITY', 'CONDO')).toBeNull()
  })
})

describe('computeGrossYieldPct', () => {
  it('matches the standard gross yield formula', () => {
    expect(computeGrossYieldPct(105000, 1500000)).toBeCloseTo(7, 6)
  })
})
