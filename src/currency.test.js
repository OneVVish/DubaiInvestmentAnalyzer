import { describe, expect, it } from 'vitest'
import { AED_PER_USD, convertFromAED } from './currency.js'

describe('convertFromAED', () => {
  it('returns the AED amount unchanged for AED', () => {
    expect(convertFromAED(1000, 'AED')).toBe(1000)
  })

  it('converts to USD using the official peg', () => {
    expect(convertFromAED(AED_PER_USD, 'USD')).toBeCloseTo(1, 6)
  })

  it('converts to GBP, CAD, and INR', () => {
    expect(convertFromAED(4.7, 'GBP')).toBeCloseTo(1, 6)
    expect(convertFromAED(2.0, 'CAD')).toBeCloseTo(1, 6)
    expect(convertFromAED(0.044, 'INR')).toBeCloseTo(1, 6)
  })

  it('falls back to AED for an unknown currency code', () => {
    expect(convertFromAED(500, 'XYZ')).toBe(500)
  })
})
