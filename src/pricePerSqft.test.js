import { describe, expect, it } from 'vitest'
import { computePropertyPrice, getPricePerSqft } from './pricePerSqft.js'

describe('getPricePerSqft', () => {
  it('returns the known rate for a covered community/asset-class combo', () => {
    expect(getPricePerSqft('MARINA', 'CONDO')).toBe(2058)
    expect(getPricePerSqft('PALM', 'VILLA')).toBe(8070)
  })

  it('returns null when that community/asset-class combination is not covered', () => {
    expect(getPricePerSqft('MARINA', 'VILLA')).toBeNull()
    expect(getPricePerSqft('DAMAC_HILLS', 'CONDO')).toBeNull()
  })

  it('returns null for a community not covered by this guide at all', () => {
    expect(getPricePerSqft('DIFC', 'CONDO')).toBeNull()
  })

  it('returns null for an unknown community', () => {
    expect(getPricePerSqft('NOT_A_COMMUNITY', 'CONDO')).toBeNull()
  })
})

describe('computePropertyPrice', () => {
  it('multiplies size by rate', () => {
    expect(computePropertyPrice(1200, 2058)).toBe(2469600)
  })
})
