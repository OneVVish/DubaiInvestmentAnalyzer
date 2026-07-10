import { describe, expect, it } from 'vitest'
import { formatCurrency } from './format.js'

// Intl inserts a non-breaking space (U+00A0) between "AED" and the number,
// not a regular space — matters for exact string equality below.
const NBSP = ' '

describe('formatCurrency', () => {
  it('formats compactly in AED by default', () => {
    expect(formatCurrency(650000)).toBe(`AED${NBSP}650K`)
    expect(formatCurrency(1245000)).toBe(`AED${NBSP}1.2M`)
  })

  it('formats full precision with no decimals when compact is false', () => {
    expect(formatCurrency(650000, 'AED', false)).toBe(`AED${NBSP}650,000`)
  })

  it('converts to USD via the fixed peg before formatting', () => {
    expect(formatCurrency(3672500, 'USD', false)).toBe('$1,000,000')
  })

  it('converts to INR before formatting', () => {
    expect(formatCurrency(44, 'INR', false)).toBe('₹1,000')
  })

  it('falls back to AED for an unrecognized currency code', () => {
    expect(formatCurrency(650000, 'ZZZ', false)).toBe(`AED${NBSP}650,000`)
  })
})
