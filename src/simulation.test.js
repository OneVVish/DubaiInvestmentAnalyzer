import { describe, expect, it } from 'vitest'
import { runSimulation, calculateMortgagePayment } from './simulation.js'
import { AED_PER_USD } from './currency.js'
import { computeAnnualizedIRR } from './irr.js'

const base = {
  propertyPrice: 1000000,
  monthlyRent: 0,
  rentInflation: 0,
  vacancyRatePct: 0,
  rentalYield: 6,
  assetClass: 'CONDO',
  nearMetro: false,
  nearAirport: false,
  preHandoverAppreciation: 0,
  postHandoverAppreciation: 0,
  propertyStatus: 'READY',
  developerPlan: 'EMAAR',
  exitStrategy: 'HOLD',
  downPaymentPct: 100,
  mortgageRate: 5,
  mortgageTermYears: 25,
  propertySizeSqft: 1000,
  serviceChargeRate: 0,
  homeInsuranceAnnual: 0,
  yearlyMaintenance: 0,
  costInflation: 0,
  sellingCostPct: 0,
  dldFeePct: 0,
  dldWaiverPct: 0,
  stockReturn: 0,
  citizenship: 'UAE/Other',
  taxResidence: 'UAE',
  isPrimaryResidence: false,
  marginalTaxRateFed: 0,
  marginalTaxRateState: 0,
  marginalTaxRateSingle: 0,
  capitalGainsTaxRatePct: 0,
}

describe('calculateMortgagePayment', () => {
  it('matches the standard amortization formula', () => {
    expect(calculateMortgagePayment(300000, 6, 360)).toBeCloseTo(1798.65, 1)
  })
})

describe('runSimulation — Ready property', () => {
  it('an all-cash, zero-rate, tax-free scenario stays flat at the property price', () => {
    const { data } = runSimulation(base)
    expect(data[0]).toMatchObject({ year: 1, buyerNetWorth: 1000000, renterNetWorth: 1000000, homeValue: 1000000 })
    expect(data[29]).toMatchObject({ year: 30, buyerNetWorth: 1000000, renterNetWorth: 1000000 })
  })

  it('service charges are size x rate — a real landlord carrying cost that reduces Buyer Net Worth, leaving Investing untouched', () => {
    const noCharges = runSimulation(base)
    const withCharges = runSimulation({ ...base, propertySizeSqft: 1200, serviceChargeRate: 16 }) // Dubai Marina rate
    const annualCharge = 1200 * 16
    // As a landlord, carrying costs paid without offsetting rental income are a real
    // loss to Buyer Net Worth (via landlordSurplus) — unlike the old occupant model,
    // they no longer mirror through to the Investing side at all (Investing now
    // matches only the equity-building capital, not carrying costs).
    expect(noCharges.data[0].buyerNetWorth - withCharges.data[0].buyerNetWorth).toBeCloseTo(annualCharge, 0)
    expect(withCharges.data[0].renterNetWorth).toBe(noCharges.data[0].renterNetWorth)
  })

  // Appreciation now steps at months 1, 13, and 25 (starts immediately,
  // not after a full year) — so by year 3 (month 36), 3 steps have fired.
  // Ready properties always use the post-handover rate — they have no
  // construction phase.
  const YEAR3_HOME_VALUE_AT_50PCT = 1000000 * 1.5 ** 3

  it('a UAE tax-free profile owes no exit tax on a large gain', () => {
    const { data } = runSimulation({ ...base, postHandoverAppreciation: 50 })
    expect(data[2].homeValue).toBe(YEAR3_HOME_VALUE_AT_50PCT)
    expect(data[2].buyerNetWorth).toBe(YEAR3_HOME_VALUE_AT_50PCT) // full gain, no tax
  })

  it('a US citizen owes exit tax only on profit beyond the $250K USD exemption — but only if marked a Personal Primary Residence', () => {
    const { data } = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'USA',
      taxResidence: 'UAE',
      isPrimaryResidence: true,
    })
    const profitAED = YEAR3_HOME_VALUE_AT_50PCT - 1000000
    const taxableUSD = Math.max(0, profitAED / AED_PER_USD - 250000)
    const expectedTax = taxableUSD * AED_PER_USD * 0.15
    expect(data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - expectedTax, 0)
    expect(expectedTax).toBeGreaterThan(0) // sanity: this scenario actually exceeds the exemption
  })

  it('UK and Canada residents owe zero exit tax even on a large gain, when marked a Personal Primary Residence', () => {
    const uk = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'UK',
      taxResidence: 'UK',
      isPrimaryResidence: true,
    })
    const canada = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'UAE/Other',
      taxResidence: 'Canada',
      isPrimaryResidence: true,
    })
    expect(uk.data[2].buyerNetWorth).toBe(YEAR3_HOME_VALUE_AT_50PCT)
    expect(canada.data[2].buyerNetWorth).toBe(YEAR3_HOME_VALUE_AT_50PCT)
  })

  it('India owes exit tax on the full profit, with no exemption, regardless of the Personal Primary Residence toggle', () => {
    const { data } = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'India',
      taxResidence: 'India',
      capitalGainsTaxRatePct: 12.5, // India's real LTCG rate — happens to equal exitTaxPct too, so the toggle is moot
    })
    const profitAED = YEAR3_HOME_VALUE_AT_50PCT - 1000000
    const expectedTax = profitAED * 0.125
    expect(data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - expectedTax, 0)
  })

  it("by default (not a Personal Primary Residence), a Hold exit is taxed at the user's own Capital Gains Tax Rate — no primary-residence relief", () => {
    // Buying now models a landlord throughout, so the default (isPrimaryResidence:
    // false, inherited from `base`) forfeits primary-residence relief — a Hold
    // exit uses the same user-supplied capitalGainsTaxRatePct as a Flip, no
    // exemption, regardless of citizenship.
    const us = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'USA',
      taxResidence: 'UAE',
      capitalGainsTaxRatePct: 15,
    })
    const uk = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'UK',
      taxResidence: 'UK',
      capitalGainsTaxRatePct: 20,
    })
    const canada = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'UAE/Other',
      taxResidence: 'Canada',
      capitalGainsTaxRatePct: 15,
    })
    const profit = YEAR3_HOME_VALUE_AT_50PCT - 1000000
    expect(us.data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - profit * 0.15, 0)
    expect(uk.data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - profit * 0.2, 0)
    expect(canada.data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - profit * 0.15, 0)
  })
})

describe('runSimulation — Off-plan, Hold', () => {
  it('Emaar: fully paid off and worth exactly the property price at handover (year 3)', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'EMAAR' })
    expect(data[2].buyerNetWorth).toBe(1000000)
    expect(data[2].renterNetWorth).toBe(1000000)
  })

  it('Damac: fully paid off and worth exactly the property price at handover (year 3), same shape as Emaar', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DAMAC' })
    expect(data[2].buyerNetWorth).toBe(1000000)
    expect(data[2].buyerCashPortion).toBeCloseTo(0, 0)
  })

  it('Balanced 50/50: only 50% paid at handover (year 3) — the 50% back-end spreads over the 36 months after', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'BALANCED_5050' })
    expect(data[2].buyerNetWorth).toBe(500000)
    expect(data[2].buyerCashPortion).toBeCloseTo(500000, 0) // still tracked, just not counted
  })

  it('Balanced 50/50: fully paid off by month 72 (year 6), once its post-handover installments finish', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'BALANCED_5050' })
    expect(data[5].buyerNetWorth).toBe(1000000) // year 6 = month 72
    expect(data[5].buyerCashPortion).toBeCloseTo(0, 0)
  })

  it('Aggressive 40/60: only 40% paid at handover (year 3) — the 60% back-end spreads over the 60 months after', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'AGGRESSIVE_4060' })
    expect(data[2].buyerNetWorth).toBe(400000)
    expect(data[2].buyerCashPortion).toBeCloseTo(600000, 0) // still tracked, just not counted
  })

  it('Aggressive 40/60: fully paid off by month 96 (year 8), once its post-handover installments finish', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'AGGRESSIVE_4060' })
    expect(data[7].buyerNetWorth).toBe(1000000) // year 8 = month 96
    expect(data[7].buyerCashPortion).toBeCloseTo(0, 0)
  })

  it('Danube: still owes 44% at handover (20% booking + 36% by month 36), so net worth is only the 56% actually paid in', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE' })
    expect(data[2].buyerNetWorth).toBe(560000)
    expect(data[2].buyerCashPortion).toBeCloseTo(440000, 0) // still tracked, just not counted
  })

  it('Danube: fully paid off by month 80, with no float left over once the last installment lands', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE' })
    // Fully paid off by month 80 (20% booking + 80 months of 1%) -> cost-basis equity reaches
    // the full 1,000,000 with 0% appreciation, 0% rent (base). No imputed rental credit is added
    // to the float anymore, so it exactly zeroes out once the installments end.
    expect(data[6].buyerNetWorth).toBe(1000000) // year 7 = month 84, 4 months after month 80 payoff
    expect(data[6].buyerCashPortion).toBeCloseTo(0, 0)
  })

  it('Danube Classic: still owes 54% at handover (10% booking + 36% by month 36), so net worth is only the 46% actually paid in', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE_CLASSIC' })
    expect(data[2].buyerNetWorth).toBe(460000)
    expect(data[2].buyerCashPortion).toBeCloseTo(540000, 0) // still tracked, just not counted
  })

  it('Danube Classic: fully paid off by month 90, with no float left over once the last installment lands', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE_CLASSIC' })
    // Fully paid off by month 90 (10% booking + 90 months of 1%) -> cost-basis equity reaches
    // the full 1,000,000 with 0% appreciation, 0% rent (base). No imputed rental credit is added
    // to the float anymore, so it exactly zeroes out once the installments end.
    expect(data[7].buyerNetWorth).toBe(1000000) // year 8 = month 96, 6 months after month 90 payoff
    expect(data[7].buyerCashPortion).toBeCloseTo(0, 0)
  })

  it('Danube: rentalYield input no longer feeds the computation — real Monthly Rent does, via landlordSurplus', () => {
    const withYield = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE', rentalYield: 6 })
    const withoutYield = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE', rentalYield: 0 })
    expect(withYield.data[6]).toEqual(withoutYield.data[6]) // purely informational now

    const withRent = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'DANUBE',
      monthlyRent: 8000,
      vacancyRatePct: 5,
    })
    expect(withRent.data[6].buyerLandlordSurplus).not.toBe(0) // real rent does move the needle
  })
})

describe('runSimulation — DLD transfer fee', () => {
  it('Ready: paid at month 0, so both paths lose exactly the fee amount at 0% rates', () => {
    const { data } = runSimulation({ ...base, dldFeePct: 4 })
    // Buyer: home is worth exactly the price, fee doesn't touch home equity -> stays at 1,000,000.
    // Renter: starts with downPayment + fee, no growth/rent -> stays at 1,000,000 + fee.
    expect(data[0].buyerNetWorth).toBe(1000000)
    expect(data[0].renterNetWorth).toBe(1040000)
  })

  it('Off-Plan Hold: paid from the float at booking, but that float is excluded from Buyer Net Worth', () => {
    const withFee = runSimulation({ ...base, propertyStatus: 'OFFPLAN', dldFeePct: 4 })
    const noFee = runSimulation({ ...base, propertyStatus: 'OFFPLAN', dldFeePct: 0 })
    // Cost-basis equity/appreciation (what Buyer Net Worth is now strictly defined as) don't
    // touch the DLD fee at all off-plan — it only ever reduces the excluded cash/uncommitted
    // bucket. The Renter's matching contribution still lands at month 0, same parity as Ready.
    expect(withFee.data[0].buyerNetWorth).toBe(noFee.data[0].buyerNetWorth)
    expect(noFee.data[0].buyerCashPortion - withFee.data[0].buyerCashPortion).toBeCloseTo(40000, 0)
    expect(withFee.data[0].renterNetWorth - noFee.data[0].renterNetWorth).toBeCloseTo(40000, 0)
  })

  it('Off-Plan Flip: like Hold, the DLD fee only touches the excluded float, never the sale proceeds', () => {
    const withFee = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 10,
      dldFeePct: 4,
    })
    const noFee = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 10,
      dldFeePct: 0,
    })
    expect(withFee.flipMonthlyData[35].buyerNetWorth).toBe(noFee.flipMonthlyData[35].buyerNetWorth)
  })

  it('a 50% waiver halves the effective fee', () => {
    const full = runSimulation({ ...base, dldFeePct: 4, dldWaiverPct: 0 })
    const halved = runSimulation({ ...base, dldFeePct: 4, dldWaiverPct: 50 })
    const none = runSimulation({ ...base, dldFeePct: 4, dldWaiverPct: 100 })
    expect(full.data[0].renterNetWorth - halved.data[0].renterNetWorth).toBeCloseTo(20000, 0) // half of 40,000
    expect(halved.data[0].renterNetWorth - none.data[0].renterNetWorth).toBeCloseTo(20000, 0)
  })

  it('a 100% waiver is identical to no fee at all', () => {
    const waived = runSimulation({ ...base, dldFeePct: 4, dldWaiverPct: 100 })
    const noFee = runSimulation({ ...base, dldFeePct: 0, dldWaiverPct: 0 })
    expect(waived.data[0]).toEqual(noFee.data[0])
  })

  it("a DLD waiver has no effect on a Flip's own sale proceeds either — same excluded-float parity as Hold", () => {
    const full = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 10,
      dldFeePct: 4,
      dldWaiverPct: 0,
    })
    const waived = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 10,
      dldFeePct: 4,
      dldWaiverPct: 100,
    })
    expect(waived.flipMonthlyData[35].buyerNetWorth).toBe(full.flipMonthlyData[35].buyerNetWorth)
  })
})

describe('runSimulation — Off-plan, Flip Before Handover', () => {
  it('flipMonth is 36 for a plan that finishes exactly at handover (Emaar) — same as HANDOVER_MONTH', () => {
    const { flipMonth } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    expect(flipMonth).toBe(36)
  })

  it("for Emaar, the flip's sale proceeds exactly match what Hold reports at that same month — Flip is now Hold, truncated at payoff", () => {
    const flip = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    const hold = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'HOLD',
    })
    expect(flip.flipMonthlyData[35].buyerNetWorth).toBe(hold.data[2].buyerNetWorth)
  })

  it("flipMonth tracks the chosen plan's own final installment — well past handover for long-tail plans", () => {
    const flipMonthFor = (developerPlan) =>
      runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan, exitStrategy: 'FLIP' }).flipMonth
    expect(flipMonthFor('BALANCED_5050')).toBe(72)
    expect(flipMonthFor('AGGRESSIVE_4060')).toBe(96)
    expect(flipMonthFor('DANUBE')).toBe(80)
    expect(flipMonthFor('DANUBE_CLASSIC')).toBe(90)
  })

  it('a long-tail Flip starts collecting rent from month 37 onward, same as Hold — no rent up through handover itself', () => {
    const { flipMonthlyData } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'DANUBE',
      exitStrategy: 'FLIP',
      monthlyRent: 8000,
    })
    expect(flipMonthlyData.find((d) => d.month === 36).buyerLandlordSurplus).toBe(0)
    expect(flipMonthlyData.find((d) => d.month === 37).buyerLandlordSurplus).toBeGreaterThan(0)
  })

  it('CAGR is a true IRR — exceeds a naive lump-sum CAGR on the full price paid in, since staged installments had less time to grow', () => {
    const { flipCAGR } = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    // The full price is paid in by month 36 now (nothing skipped), growing at a
    // flat 10%/yr for 3 years — a naive final-value/total-invested CAGR is just
    // the raw rate itself. The true IRR must exceed it: most of that capital
    // went in well after month 0, so it had less time to compound than a naive
    // calc assumes.
    const naiveLumpSumCagr = 0.1
    expect(flipCAGR).toBeGreaterThan(naiveLumpSumCagr)
  })

  it('CAGR matches an independently-built monthly cash-flow IRR (every installment paid in full, sale proceeds layered on top of the final month)', () => {
    const { flipCAGR, flipMonthlyData, flipMonth } = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    // Booking (20%) at month 0, then 60%/36 per month through month 35, plus
    // Emaar's 20% lump on top of month 36's own installment — Emaar's shape
    // (see paymentPlans.test.js) — with the sale proceeds landing in that same
    // month, on top of that installment.
    const monthlyInstallment = (1000000 * 0.6) / 36
    const cashFlows = [-(1000000 * 0.2), ...Array(35).fill(-monthlyInstallment)]
    cashFlows[flipMonth] = -(monthlyInstallment + 1000000 * 0.2) + flipMonthlyData[flipMonth - 1].buyerNetWorth
    expect(flipCAGR).toBeCloseTo(computeAnnualizedIRR(cashFlows), 6)
  })

  it('flipCAGR stays positive and sensible for a long-tail plan too (Danube, flip at month 80)', () => {
    const { flipCAGR, flipMonth } = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      postHandoverAppreciation: 5,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'DANUBE',
      exitStrategy: 'FLIP',
    })
    expect(flipMonth).toBe(80)
    expect(flipCAGR).toBeGreaterThan(0)
  })

  it('flipCAGR is null for a Ready property or an Off-Plan Hold', () => {
    expect(runSimulation(base).flipCAGR).toBeNull()
    expect(runSimulation({ ...base, propertyStatus: 'OFFPLAN', exitStrategy: 'HOLD' }).flipCAGR).toBeNull()
  })

  it('a Flip now respects the Personal Primary Residence exemption, same as Hold (no longer flatly denied)', () => {
    const withExemption = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
      citizenship: 'USA',
      taxResidence: 'UAE',
      capitalGainsTaxRatePct: 15,
      isPrimaryResidence: true,
    })
    const withoutExemption = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
      citizenship: 'USA',
      taxResidence: 'UAE',
      capitalGainsTaxRatePct: 15,
      isPrimaryResidence: false,
    })
    expect(withExemption.flipMonthlyData[35].buyerNetWorth).toBeGreaterThan(
      withoutExemption.flipMonthlyData[35].buyerNetWorth,
    )
  })

  it('after flipping, the buyer path simply compounds and no longer tracks home equity', () => {
    const { data } = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      stockReturn: 8,
    })
    expect(data[29].buyerNetWorth).toBeGreaterThan(data[2].buyerNetWorth)
  })
})

describe('runSimulation — flipMonthlyData (month-by-month timeline for a Flip)', () => {
  it('is empty for a Ready property and for an Off-Plan Hold', () => {
    expect(runSimulation(base).flipMonthlyData).toEqual([])
    expect(
      runSimulation({ ...base, propertyStatus: 'OFFPLAN', exitStrategy: 'HOLD' }).flipMonthlyData,
    ).toEqual([])
  })

  it('has exactly 36 monthly entries for a Flip, running from month 1 to month 36', () => {
    const { flipMonthlyData } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    expect(flipMonthlyData).toHaveLength(36)
    expect(flipMonthlyData[0].month).toBe(1)
    expect(flipMonthlyData[35].month).toBe(36)
  })

  it("the final month's buyerNetWorth matches the same flip payout the yearly data reports", () => {
    const { data, flipMonthlyData } = runSimulation({
      ...base,
      preHandoverAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    expect(flipMonthlyData[35].buyerNetWorth).toBe(data[2].buyerNetWorth)
  })

  it('cost-basis equity is non-decreasing month over month before the flip — real monthly granularity, not repeated yearly values', () => {
    const { flipMonthlyData } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    for (let i = 1; i < flipMonthlyData.length; i++) {
      expect(flipMonthlyData[i].buyerCostBasisEquity).toBeGreaterThanOrEqual(
        flipMonthlyData[i - 1].buyerCostBasisEquity,
      )
    }
    // Distinct values across the window confirm it isn't just the same 3 yearly figures repeated.
    const distinctValues = new Set(flipMonthlyData.map((d) => d.buyerCostBasisEquity))
    expect(distinctValues.size).toBeGreaterThan(3)
  })

  it('homeValue compounds smoothly every month, not in once-a-year steps', () => {
    const { flipMonthlyData } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
      preHandoverAppreciation: 12,
    })
    // A once-a-year step would leave homeValue flat for 11 straight months
    // after each jump (months 2-12, 14-24, 26-36). With monthly compounding,
    // every single month grows over the last.
    for (let i = 1; i < flipMonthlyData.length; i++) {
      expect(flipMonthlyData[i].homeValue).toBeGreaterThan(flipMonthlyData[i - 1].homeValue)
    }
    // Twelve monthly steps at the twelfth root multiply out to exactly the
    // old single annual step — month 12 matches price * (1 + rate) exactly.
    expect(flipMonthlyData[11].homeValue).toBe(Math.round(1000000 * 1.12))
  })
})

describe('runSimulation — equity vs appreciation breakdown', () => {
  // Buyer Net Worth is Cost-Basis Equity + Appreciation Gain + Landlord
  // Surplus (accumulated rental profit — 0 whenever `base`'s monthlyRent:
  // 0 is left untouched, which is most of these tests). Cash/Uncommitted
  // is tracked (for the breakdown chart) but deliberately excluded, since
  // it's idle capital, not realized property value. Not true for a flip,
  // where the cash IS the realized, cashed-out value — see the dedicated
  // Flip test below instead.
  // Precision -1 (tolerance < 5) absorbs the +/-1-2 AED drift from rounding
  // each component independently, vs. rounding the total once.
  const equityPlusAppreciationEqualsNetWorth = (row) =>
    expect(row.buyerCostBasisEquity + row.buyerAppreciationGain + row.buyerLandlordSurplus).toBeCloseTo(
      row.buyerNetWorth,
      -1,
    )

  it('Ready, mortgaged, with appreciation and a US exit tax: equity + appreciation always equal net worth', () => {
    const { data } = runSimulation({
      ...base,
      downPaymentPct: 20,
      postHandoverAppreciation: 8,
      citizenship: 'USA',
      taxResidence: 'UAE',
      capitalGainsTaxRatePct: 15,
    })
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('Ready: cost-basis equity grows via mortgage paydown even with zero appreciation', () => {
    const { data } = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5 })
    expect(data[0].buyerCostBasisEquity).toBeGreaterThan(200000) // more than the 20% down payment alone
    expect(data[0].buyerAppreciationGain).toBe(0) // 0% appreciation in `base`
    expect(data[0].buyerCashPortion).toBe(0) // Ready never has an off-plan float
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('Ready: appreciation gain is the full price growth when paid in cash (no loan to net against)', () => {
    const { data } = runSimulation({ ...base, postHandoverAppreciation: 10 })
    expect(data[2].buyerCostBasisEquity).toBe(1000000) // fully paid, no mortgage
    // Year 3 (month 36) has had 3 annual step-ups (months 1, 13, 25 —
    // appreciation starts immediately, unlike rent/cost inflation).
    expect(data[2].buyerAppreciationGain).toBeCloseTo(1000000 * 1.1 ** 3 - 1000000, 0)
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('Off-Plan construction: cost-basis equity is what has actually been paid to the developer', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 10,
    })
    // Year 1 (month 12): booking (20%) + 12 monthly installments already paid.
    const paidByMonth12 = 200000 + 12 * ((600000 / 36))
    expect(data[0].buyerCostBasisEquity).toBeCloseTo(paidByMonth12, 0)
    expect(data[0].buyerCashPortion).toBeGreaterThan(0) // unspent float, tracked but excluded from net worth
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('Off-Plan construction: appreciation gain is the FULL gain, not scaled by how much is paid in yet', () => {
    // The contract locks in the original price at signing — its worth if exited
    // today is the full current market value minus what's still owed, matching
    // how the Flip and post-handover branches already work. Regression test for
    // a bug where this was wrongly multiplied by paidToDeveloper/propertyPrice.
    const { data } = runSimulation({
      ...base,
      propertyPrice: 2500000,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 20,
    })
    // Year 1 (month 12): one appreciation step already fired (at month 1).
    const expectedHomeValue = 2500000 * 1.2
    expect(data[0].homeValue).toBe(Math.round(expectedHomeValue))
    expect(data[0].buyerAppreciationGain).toBeCloseTo(expectedHomeValue - 2500000, 0) // full 500,000, not a fraction
  })

  it('Off-Plan Hold, post-handover: equity + appreciation still equal net worth through the Danube phase', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'DANUBE',
      preHandoverAppreciation: 6,
      postHandoverAppreciation: 6,
      rentalYield: 6,
    })
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('switches from the pre- to the post-handover rate exactly at handover', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      preHandoverAppreciation: 20,
      postHandoverAppreciation: 5,
    })
    // 3 pre-handover steps by year 3 (months 1, 13, 25) at 20%, then the
    // month-37 step (year 4) is the first to use the post-handover rate.
    const year3 = 1000000 * 1.2 ** 3
    const year4 = year3 * 1.05
    expect(data[2].homeValue).toBe(Math.round(year3))
    expect(data[3].homeValue).toBe(Math.round(year4))
  })

  it('Flip month: the sale is attributed back to equity paid in vs. appreciation gain, not dumped into cash', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      preHandoverAppreciation: 10,
    })
    const v36 = 1000000 * 1.1 ** 3
    const profit = v36 - 1000000
    expect(data[2].buyerCostBasisEquity).toBe(1000000) // fully paid off by month 36 now (base has 0% dld fee)
    expect(data[2].buyerAppreciationGain).toBeCloseTo(profit, 0) // base has 0% exit tax
    expect(data[2].buyerCashPortion).toBe(0)
    equityPlusAppreciationEqualsNetWorth(data[2])
  })

  it('Post-flip years (if ever shown) revert to pure cash, since the payout is now just a stock portfolio', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      preHandoverAppreciation: 10,
      stockReturn: 8,
    })
    expect(data[3].buyerCostBasisEquity).toBe(0)
    expect(data[3].buyerAppreciationGain).toBe(0)
    expect(data[3].buyerCashPortion).toBe(data[3].buyerNetWorth)
  })
})

describe('runSimulation — renterContributed/renterGrowth and buyerCapitalInvested (ROI/breakdown inputs)', () => {
  it('renterContributed + renterGrowth always equal renterNetWorth', () => {
    const { data } = runSimulation({
      ...base,
      downPaymentPct: 20,
      mortgageRate: 5,
      postHandoverAppreciation: 8,
      stockReturn: 6,
      monthlyRent: 4000,
    })
    // Precision -1 (tolerance < 5) absorbs the +/-1-2 AED drift from rounding
    // each component independently, same as equityPlusAppreciationEqualsNetWorth above.
    data.forEach((d) => expect(d.renterContributed + d.renterGrowth).toBeCloseTo(d.renterNetWorth, -1))
  })

  it('renterContributed grows by exactly the same monthly contribution the Buyer would have made, uncompounded', () => {
    const { data, downPayment } = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5 })
    // 0% stock return in `base`, so renterContributed is just a running sum —
    // year 1's value is the starting capital plus 12 months of mortgage P&I.
    const { mortgagePayment } = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5 })
    expect(data[0].renterContributed).toBeCloseTo(downPayment + mortgagePayment * 12, 0)
  })

  it("buyerCapitalInvested freezes at its pre-flip value once flipped — doesn't reset like buyerCostBasisEquity", () => {
    const { data, flipMonth } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    const atFlipYear = flipMonth / 12 - 1 // data[] is 0-indexed by year
    const capitalAtFlip = data[atFlipYear].buyerCapitalInvested
    expect(capitalAtFlip).toBeGreaterThan(0)
    for (let i = atFlipYear + 1; i < data.length; i++) {
      expect(data[i].buyerCapitalInvested).toBe(capitalAtFlip)
      expect(data[i].buyerCostBasisEquity).toBe(0) // resets, unlike buyerCapitalInvested
    }
  })

  it('buyerCapitalInvested matches buyerCostBasisEquity before any flip (same underlying cash, not yet frozen)', () => {
    const { data } = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5, postHandoverAppreciation: 8 })
    data.forEach((d) => expect(d.buyerCapitalInvested).toBe(d.buyerCostBasisEquity))
  })
})

describe('runSimulation — buyerIRR/renterIRR (30-year annualized return)', () => {
  it("renterIRR converges to exactly the user's net stock return when there's no tax drag", () => {
    const { renterIRR } = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5, stockReturn: 7 })
    expect(renterIRR).toBeCloseTo(0.07, 4)
  })

  it('buyerIRR is a true IRR — cross-checks against an independently-built monthly cash-flow array for a 100%-cash Ready purchase', () => {
    const { data, buyerIRR, downPayment } = runSimulation({
      ...base,
      downPaymentPct: 100,
      postHandoverAppreciation: 8,
      monthlyRent: 4000,
    })
    // 100% cash: no mortgage, so the Buyer's own monthly cash flow is just
    // the after-tax rental profit each month (0% tax/vacancy in `base`) —
    // rebuild it independently and confirm the IRR matches.
    const monthlyRentAfterCosts = 4000 // base has 0% vacancy, 0 carrying costs
    const cashFlows = [-downPayment, ...Array(360).fill(monthlyRentAfterCosts)] // month 0 + months 1-360
    cashFlows[360] += data[29].buyerNetWorth
    expect(buyerIRR).toBeCloseTo(computeAnnualizedIRR(cashFlows), 5)
  })

  it('buyerIRR/renterIRR are non-null and finite for an Off-Plan Hold too (long, mostly-zero-then-lump cash flows)', () => {
    const { buyerIRR, renterIRR } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'DANUBE',
      exitStrategy: 'HOLD',
      preHandoverAppreciation: 8,
      postHandoverAppreciation: 6,
      monthlyRent: 4000,
    })
    expect(Number.isFinite(buyerIRR)).toBe(true)
    expect(Number.isFinite(renterIRR)).toBe(true)
  })
})

describe('runSimulation — appreciation modifiers', () => {
  it('higher post-handover appreciation grows a Ready property faster', () => {
    const lower = runSimulation({ ...base, postHandoverAppreciation: 5 })
    const higher = runSimulation({ ...base, postHandoverAppreciation: 10 })
    expect(higher.data[10].homeValue).toBeGreaterThan(lower.data[10].homeValue)
  })

  it('infrastructure bonuses increase appreciation beyond the base slider', () => {
    const plain = runSimulation({ ...base, postHandoverAppreciation: 5 })
    const withMetro = runSimulation({ ...base, postHandoverAppreciation: 5, nearMetro: true })
    const withBoth = runSimulation({ ...base, postHandoverAppreciation: 5, nearMetro: true, nearAirport: true })
    expect(withMetro.data[5].homeValue).toBeGreaterThan(plain.data[5].homeValue)
    expect(withBoth.data[5].homeValue).toBeGreaterThan(withMetro.data[5].homeValue)
  })

  it('infrastructure bonuses also apply to the pre-handover rate during off-plan construction', () => {
    const plain = runSimulation({ ...base, propertyStatus: 'OFFPLAN', preHandoverAppreciation: 10 })
    const withBoth = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      preHandoverAppreciation: 10,
      nearMetro: true,
      nearAirport: true,
    })
    expect(withBoth.data[0].homeValue).toBeGreaterThan(plain.data[0].homeValue)
  })
})

describe('runSimulation — Buying as landlord, Investing matches only equity capital', () => {
  it('a 100%-cash Ready property produces a single lump-sum Investing comparison, with no further monthly additions', () => {
    const { data } = runSimulation({ ...base, downPaymentPct: 100, stockReturn: 8 })
    // Pure compounding of the lump sum, no periodic mortgage contribution —
    // consecutive years grow by the same ratio.
    const growthYear1to2 = data[1].renterNetWorth / data[0].renterNetWorth
    const growthYear2to3 = data[2].renterNetWorth / data[1].renterNetWorth
    expect(growthYear1to2).toBeCloseTo(growthYear2to3, 4)
    expect(data[0].renterNetWorth).toBeGreaterThan(1000000)
  })

  it("Investing's Ready-property contribution equals the full mortgage P&I", () => {
    const { data, mortgagePayment, downPayment } = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5 })
    // 0% stock return in `base`, so year 1's renterNetWorth is just the starting
    // capital plus 12 months of the exact mortgage payment — no compounding to
    // account for, and no carrying costs mixed in (those are landlordSurplus's).
    expect(data[0].renterNetWorth).toBeCloseTo(downPayment + mortgagePayment * 12, 0)
  })

  it('a mortgaged Ready property accumulates landlordSurplus = collected rent minus mortgage payment minus carrying costs', () => {
    const monthlyRent = 5000
    const vacancyRatePct = 10
    const { data, mortgagePayment } = runSimulation({
      ...base,
      downPaymentPct: 20,
      mortgageRate: 5,
      monthlyRent,
      vacancyRatePct,
      homeInsuranceAnnual: 1200,
      yearlyMaintenance: 2400,
    })
    const collectedRent = monthlyRent * (1 - vacancyRatePct / 100)
    const monthlyCarryingCosts = 1200 / 12 + 2400 / 12
    const expectedMonthlySurplus = collectedRent - mortgagePayment - monthlyCarryingCosts
    expect(data[0].buyerLandlordSurplus).toBeCloseTo(expectedMonthlySurplus * 12, 0) // 0% stock return, so a simple sum
  })

  it('higher vacancy strictly lowers landlordSurplus (and Buyer Net Worth) without touching equity, appreciation, or Investing', () => {
    const lowVacancy = runSimulation({ ...base, downPaymentPct: 20, monthlyRent: 5000, vacancyRatePct: 5 })
    const highVacancy = runSimulation({ ...base, downPaymentPct: 20, monthlyRent: 5000, vacancyRatePct: 15 })
    expect(highVacancy.data[0].buyerLandlordSurplus).toBeLessThan(lowVacancy.data[0].buyerLandlordSurplus)
    expect(highVacancy.data[0].buyerNetWorth).toBeLessThan(lowVacancy.data[0].buyerNetWorth)
    expect(highVacancy.data[0].buyerCostBasisEquity).toBe(lowVacancy.data[0].buyerCostBasisEquity)
    expect(highVacancy.data[0].buyerAppreciationGain).toBe(lowVacancy.data[0].buyerAppreciationGain)
    expect(highVacancy.data[0].renterNetWorth).toBe(lowVacancy.data[0].renterNetWorth)
  })

  it('off-plan pre-handover: rent no longer reduces the buyer float — construction-phase numbers are unaffected by Monthly Rent', () => {
    const withRent = runSimulation({ ...base, propertyStatus: 'OFFPLAN', monthlyRent: 5000 })
    const noRent = runSimulation({ ...base, propertyStatus: 'OFFPLAN', monthlyRent: 0 })
    expect(withRent.data[0]).toEqual(noRent.data[0])
  })
})

describe('runSimulation — rental income tax and Capital Gains Tax Rate (personal marginal rates, not stockDragPct)', () => {
  it('a US landlord pays Federal + State combined on positive rental cash flow', () => {
    const monthlyRent = 6000
    const marginalTaxRateFed = 37
    const marginalTaxRateState = 13.3
    const { data, mortgagePayment } = runSimulation({
      ...base,
      downPaymentPct: 20,
      mortgageRate: 5,
      monthlyRent,
      citizenship: 'USA',
      taxResidence: 'UAE',
      marginalTaxRateFed,
      marginalTaxRateState,
    })
    const landlordCashFlow = monthlyRent - mortgagePayment
    const combinedRate = (marginalTaxRateFed + marginalTaxRateState) / 100
    const expectedAfterTaxMonthly = landlordCashFlow - landlordCashFlow * combinedRate
    expect(data[0].buyerLandlordSurplus).toBeCloseTo(expectedAfterTaxMonthly * 12, 0) // 0% stock return, so a simple sum
  })

  it('a UK landlord pays only the single marginal rate, ignoring the unused Fed/State fields', () => {
    const monthlyRent = 6000
    const marginalTaxRateSingle = 45
    const { data, mortgagePayment } = runSimulation({
      ...base,
      downPaymentPct: 20,
      mortgageRate: 5,
      monthlyRent,
      citizenship: 'UK',
      taxResidence: 'UK',
      marginalTaxRateSingle,
      marginalTaxRateFed: 999, // must be ignored — UK doesn't use Fed/State
      marginalTaxRateState: 999,
    })
    const landlordCashFlow = monthlyRent - mortgagePayment
    const expectedAfterTaxMonthly = landlordCashFlow - landlordCashFlow * (marginalTaxRateSingle / 100)
    expect(data[0].buyerLandlordSurplus).toBeCloseTo(expectedAfterTaxMonthly * 12, 0)
  })

  it('a rental loss (negative cash flow) is not taxed — no refund on the way down', () => {
    // A large mortgage payment relative to rent produces a monthly loss; taxing
    // it would mean a NEGATIVE tax (a refund), which real rental-loss rules
    // don't hand out for free — this app simply doesn't tax losses at all.
    const { data } = runSimulation({
      ...base,
      downPaymentPct: 5,
      mortgageRate: 5,
      monthlyRent: 100,
      citizenship: 'USA',
      taxResidence: 'UAE',
      marginalTaxRateFed: 37,
      marginalTaxRateState: 13.3,
    })
    const withTax = data[0].buyerLandlordSurplus
    const { data: noTaxData } = runSimulation({
      ...base,
      downPaymentPct: 5,
      mortgageRate: 5,
      monthlyRent: 100,
      citizenship: 'USA',
      taxResidence: 'UAE',
      marginalTaxRateFed: 0,
      marginalTaxRateState: 0,
    })
    expect(withTax).toBe(noTaxData[0].buyerLandlordSurplus) // untaxed either way — it's a loss
  })

  it('the UAE/tax-free profile ignores the marginal rate inputs entirely — always untaxed', () => {
    const withRates = runSimulation({
      ...base,
      downPaymentPct: 20,
      mortgageRate: 5,
      monthlyRent: 6000,
      marginalTaxRateFed: 37,
      marginalTaxRateState: 13.3,
      marginalTaxRateSingle: 45,
    })
    const withoutRates = runSimulation({ ...base, downPaymentPct: 20, mortgageRate: 5, monthlyRent: 6000 })
    expect(withRates.data[0]).toEqual(withoutRates.data[0])
  })

  it('Capital Gains Tax Rate is a free-standing input — applies on a Hold exit regardless of citizenship', () => {
    const { data } = runSimulation({
      ...base,
      postHandoverAppreciation: 10,
      capitalGainsTaxRatePct: 25, // an arbitrary rate, not tied to any built-in citizenship figure
    })
    const profit = 1000000 * 1.1 ** 3 - 1000000
    const expectedTax = profit * 0.25
    expect(data[2].buyerNetWorth).toBeCloseTo(1000000 * 1.1 ** 3 - expectedTax, 0)
  })

  it("a Personal Primary Residence ignores the Capital Gains Tax Rate input entirely — it's not used on that path", () => {
    const primaryResidence = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'India',
      taxResidence: 'India',
      isPrimaryResidence: true,
      capitalGainsTaxRatePct: 99, // absurdly high — should have zero effect on this path
    })
    const expectedNoTax = runSimulation({
      ...base,
      postHandoverAppreciation: 50,
      citizenship: 'India',
      taxResidence: 'India',
      isPrimaryResidence: true,
      capitalGainsTaxRatePct: 0,
    })
    expect(primaryResidence.data[2].buyerNetWorth).toBe(expectedNoTax.data[2].buyerNetWorth)
  })
})
