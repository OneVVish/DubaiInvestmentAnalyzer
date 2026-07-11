// Solves for the internal rate of return of a series of cash flows spaced
// at regular monthly intervals, then annualizes it. Uses bisection rather
// than Newton-Raphson: every cash-flow series this app feeds in has
// exactly one sign change (a run of outflows, then one payout), which
// guarantees exactly one real root and a monotonic NPV curve — bisection
// can't diverge the way Newton's method sometimes does.
export function computeAnnualizedIRR(monthlyCashFlows) {
  // Evaluated via Horner's rule (from the last cash flow down to the
  // first), NOT the textbook sum(cf[i] / (1+r)**i) — for a 30-year, 361-
  // entry series near the bisection's extreme low bound (r close to -1),
  // (1+r)**360 underflows to exactly 0, and dividing two different cash
  // flows by that same 0 produces two independent +/-Infinity terms whose
  // sum is NaN, silently corrupting every comparison thereafter (NaN
  // comparisons are always false, so bisection degenerates toward the
  // upper bound instead of the true root). Horner's rule accumulates one
  // multiply-add at a time instead, so it saturates to a single, correctly
  // signed Infinity rather than cancelling two of them into NaN — same
  // polynomial, numerically stable at any length.
  const npv = (r) => {
    const x = 1 / (1 + r)
    let result = 0
    for (let i = monthlyCashFlows.length - 1; i >= 0; i--) {
      result = result * x + monthlyCashFlows[i]
    }
    return result
  }

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
