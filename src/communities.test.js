import { describe, expect, it } from 'vitest'
import { COMMUNITIES } from './communities.js'

describe('COMMUNITIES', () => {
  it('has a unique key for every entry', () => {
    const keys = COMMUNITIES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('includes an Other/Custom fallback option', () => {
    expect(COMMUNITIES.some((c) => c.key === 'OTHER')).toBe(true)
  })
})
