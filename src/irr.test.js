import { describe, expect, it } from 'vitest'
import { computeAnnualizedIRR } from './irr.js'

describe('computeAnnualizedIRR', () => {
  it('solves a simple invest-then-receive case against a known monthly rate', () => {
    // Invest 100 at month 0, receive 100 * 1.01^12 at month 12 -> should
    // solve back to exactly 1% monthly, 1.01^12 - 1 annualized.
    const payout = 100 * 1.01 ** 12
    const cashFlows = [-100, ...Array(11).fill(0), payout]
    const irr = computeAnnualizedIRR(cashFlows)
    expect(irr).toBeCloseTo(1.01 ** 12 - 1, 4)
  })

  it('returns ~0% when the payout exactly returns the invested capital', () => {
    const cashFlows = [-100, ...Array(11).fill(0), 100]
    const irr = computeAnnualizedIRR(cashFlows)
    expect(irr).toBeCloseTo(0, 4)
  })

  it('returns a negative rate when the payout is less than invested', () => {
    const cashFlows = [-100, ...Array(11).fill(0), 80]
    const irr = computeAnnualizedIRR(cashFlows)
    expect(irr).toBeLessThan(0)
  })

  it('gives a higher annualized rate than a naive lump-sum CAGR when contributions are staged', () => {
    // 12 equal monthly contributions of 100 (invested progressively, not all on day 0),
    // payout of 1,400 at month 12. A naive CAGR on total invested (1,200) would be
    // (1400/1200)^(1/1) - 1 (already annual since 1 year) = ~16.7%; the true IRR should
    // be higher, since later contributions had less time to grow into that same payout.
    const cashFlows = [...Array(12).fill(-100), 1400]
    const irr = computeAnnualizedIRR(cashFlows)
    const naiveCagr = 1400 / 1200 - 1
    expect(irr).toBeGreaterThan(naiveCagr)
  })

  it('returns null when there is no sign change (all cash flows the same sign)', () => {
    expect(computeAnnualizedIRR([100, 100, 100])).toBeNull()
    expect(computeAnnualizedIRR([-100, -100, -100])).toBeNull()
  })

  it('stays numerically correct on a long (30-year, 361-entry) series — regression for a bisection-bound underflow', () => {
    // At the bisection's extreme low bound (r near -1), (1+r)**360 underflows
    // to exactly 0 for a series this long, and the textbook sum(cf/(1+r)**i)
    // formula produces two independent +/-Infinity terms that cancel to NaN,
    // corrupting every comparison thereafter (bisection then silently
    // degenerates toward the upper bound instead of the true root). A flat
    // monthly contribution for 30 years, paid out at a known rate, should
    // solve back to something reasonable, not billions of a percent.
    const monthlyRate = 0.005
    const cashFlows = [-1000, ...Array(359).fill(0)]
    cashFlows[360] = 1000 * (1 + monthlyRate) ** 360
    const irr = computeAnnualizedIRR(cashFlows)
    expect(irr).toBeCloseTo((1 + monthlyRate) ** 12 - 1, 4)
  })
})
