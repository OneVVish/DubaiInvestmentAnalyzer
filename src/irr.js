// Solves for the internal rate of return of a series of cash flows spaced
// at regular monthly intervals, then annualizes it. Uses bisection rather
// than Newton-Raphson: every cash-flow series this app feeds in has
// exactly one sign change (a run of outflows, then one payout), which
// guarantees exactly one real root and a monotonic NPV curve — bisection
// can't diverge the way Newton's method sometimes does, and performance
// doesn't matter here (called once, on ~37 cash flows).
export function computeAnnualizedIRR(monthlyCashFlows) {
  const npv = (r) => monthlyCashFlows.reduce((sum, cf, i) => sum + cf / (1 + r) ** i, 0)

  let low = -0.99
  let high = 10
  if (npv(low) * npv(high) > 0) return null // no sign change in this bracket

  let mid = 0
  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2
    const npvMid = npv(mid)
    if (Math.abs(npvMid) < 1e-6) break
    if (npv(low) * npvMid < 0) {
      high = mid
    } else {
      low = mid
    }
  }
  return (1 + mid) ** 12 - 1
}
