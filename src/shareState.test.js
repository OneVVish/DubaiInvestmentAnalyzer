import { describe, expect, it } from 'vitest'
import { decodeState, encodeState } from './shareState.js'

describe('encodeState / decodeState', () => {
  it('round-trips a typical scenario object', () => {
    const state = { inputs: { homePrice: 650000, stockReturn: 7 }, chartView: 'montecarlo' }
    expect(decodeState(encodeState(state))).toEqual(state)
  })

  it('returns null instead of throwing on garbage input', () => {
    expect(decodeState('not-valid-base64-json!!!')).toBeNull()
  })
})
