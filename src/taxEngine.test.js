import { describe, expect, it } from 'vitest'
import { TAX_PROFILES, getNetStockReturn, resolveTaxProfile } from './taxEngine.js'

describe('resolveTaxProfile', () => {
  it('resolves a UAE citizen resident in the UAE as tax-free', () => {
    expect(resolveTaxProfile('UAE/Other', 'UAE')).toBe(TAX_PROFILES.FREE)
  })

  it('resolves by tax residence when citizenship is not USA', () => {
    expect(resolveTaxProfile('India', 'Canada')).toBe(TAX_PROFILES.CANADA)
    expect(resolveTaxProfile('UK', 'UK')).toBe(TAX_PROFILES.UK)
    expect(resolveTaxProfile('UAE/Other', 'India')).toBe(TAX_PROFILES.INDIA)
  })

  it('a non-US citizen resident in the US is US-taxable', () => {
    expect(resolveTaxProfile('UK', 'USA')).toBe(TAX_PROFILES.US)
  })

  it('US citizenship carries US tax exposure regardless of residence', () => {
    expect(resolveTaxProfile('USA', 'UAE')).toBe(TAX_PROFILES.US)
    expect(resolveTaxProfile('USA', 'UK')).toBe(TAX_PROFILES.US)
  })
})

describe('getNetStockReturn', () => {
  it('applies no drag for the tax-free profile', () => {
    expect(getNetStockReturn(7, TAX_PROFILES.FREE)).toBe(7)
  })

  it('applies the UK drag', () => {
    expect(getNetStockReturn(7, TAX_PROFILES.UK)).toBeCloseTo(5.6, 6)
  })

  it('applies the India drag', () => {
    expect(getNetStockReturn(8, TAX_PROFILES.INDIA)).toBeCloseTo(7, 6)
  })
})
