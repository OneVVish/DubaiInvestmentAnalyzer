import { describe, expect, it } from 'vitest'
import { computeAnnualServiceCharges, getServiceChargeRate } from './serviceCharges.js'

describe('getServiceChargeRate', () => {
  it('returns the known rate for a listed community', () => {
    expect(getServiceChargeRate('MARINA')).toBe(16)
  })

  it('returns null for Other/Custom', () => {
    expect(getServiceChargeRate('OTHER')).toBeNull()
  })

  it('returns null for an unknown key', () => {
    expect(getServiceChargeRate('NOT_A_COMMUNITY')).toBeNull()
  })

  it('returns null for a community only covered by the rental-yield source, not service charges', () => {
    expect(getServiceChargeRate('JVC')).toBeNull()
  })
})

describe('computeAnnualServiceCharges', () => {
  it('multiplies size by rate', () => {
    expect(computeAnnualServiceCharges(1200, 16)).toBe(19200)
  })
})
