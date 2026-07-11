import { describe, expect, it } from 'vitest'
import { getGeoDefaults } from './geoDefaults.js'

describe('getGeoDefaults', () => {
  it('maps the US to USD and the USA tax profile', () => {
    expect(getGeoDefaults('US')).toEqual({ currency: 'USD', citizenship: 'USA', taxResidence: 'USA' })
  })

  it('maps the UK, Canada, and India to their own currency and tax profile', () => {
    expect(getGeoDefaults('GB')).toEqual({ currency: 'GBP', citizenship: 'UK', taxResidence: 'UK' })
    expect(getGeoDefaults('CA')).toEqual({ currency: 'CAD', citizenship: 'Canada', taxResidence: 'Canada' })
    expect(getGeoDefaults('IN')).toEqual({ currency: 'INR', citizenship: 'India', taxResidence: 'India' })
  })

  it('maps the UAE to AED and the UAE/Other tax-free profile', () => {
    expect(getGeoDefaults('AE')).toEqual({ currency: 'AED', citizenship: 'UAE/Other', taxResidence: 'UAE' })
  })

  it('returns null for an unmapped or missing country code — no guess, keep today\'s defaults', () => {
    expect(getGeoDefaults('DE')).toBeNull()
    expect(getGeoDefaults(undefined)).toBeNull()
    expect(getGeoDefaults('')).toBeNull()
  })
})
