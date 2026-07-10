import { describe, expect, it } from 'vitest'
import { runSimulation, calculateMortgagePayment } from './simulation.js'
import { AED_PER_USD } from './currency.js'

const base = {
  propertyPrice: 1000000,
  monthlyRent: 0,
  rentInflation: 0,
  rentalYield: 6,
  assetClass: 'CONDO',
  nearMetro: false,
  nearAirport: false,
  homeAppreciation: 0,
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

  it('service charges are size x rate — an ongoing Buyer carrying cost, mirrored as Renter contributions', () => {
    const noCharges = runSimulation(base)
    const withCharges = runSimulation({ ...base, propertySizeSqft: 1200, serviceChargeRate: 16 }) // Dubai Marina rate
    const annualCharge = 1200 * 16
    // Carrying costs don't directly reduce the Buyer's home-equity net worth (same as
    // mortgage/insurance/maintenance already work) — they flow through as Renter
    // contributions instead, same delta mechanic used throughout.
    expect(withCharges.data[0].buyerNetWorth).toBe(noCharges.data[0].buyerNetWorth)
    expect(withCharges.data[0].renterNetWorth - noCharges.data[0].renterNetWorth).toBeCloseTo(annualCharge, 0)
  })

  // Appreciation now steps at months 1, 13, and 25 (starts immediately,
  // not after a full year) — so by year 3 (month 36), 3 steps have fired.
  const YEAR3_HOME_VALUE_AT_50PCT = 1000000 * 1.5 ** 3

  it('a UAE tax-free profile owes no exit tax on a large gain', () => {
    const { data } = runSimulation({ ...base, homeAppreciation: 50 })
    expect(data[2].homeValue).toBe(YEAR3_HOME_VALUE_AT_50PCT)
    expect(data[2].buyerNetWorth).toBe(YEAR3_HOME_VALUE_AT_50PCT) // full gain, no tax
  })

  it('a US citizen owes exit tax only on profit beyond the $250K USD exemption', () => {
    const { data } = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'USA', taxResidence: 'UAE' })
    const profitAED = YEAR3_HOME_VALUE_AT_50PCT - 1000000
    const taxableUSD = Math.max(0, profitAED / AED_PER_USD - 250000)
    const expectedTax = taxableUSD * AED_PER_USD * 0.15
    expect(data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - expectedTax, 0)
    expect(expectedTax).toBeGreaterThan(0) // sanity: this scenario actually exceeds the exemption
  })

  it('UK and Canada residents owe zero exit tax even on a large gain (primary-residence relief)', () => {
    const uk = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'UK', taxResidence: 'UK' })
    const canada = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'UAE/Other', taxResidence: 'Canada' })
    expect(uk.data[2].buyerNetWorth).toBe(YEAR3_HOME_VALUE_AT_50PCT)
    expect(canada.data[2].buyerNetWorth).toBe(YEAR3_HOME_VALUE_AT_50PCT)
  })

  it('India owes exit tax on the full profit, with no exemption', () => {
    const { data } = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'India', taxResidence: 'India' })
    const profitAED = YEAR3_HOME_VALUE_AT_50PCT - 1000000
    const expectedTax = profitAED * 0.125
    expect(data[2].buyerNetWorth).toBeCloseTo(YEAR3_HOME_VALUE_AT_50PCT - expectedTax, 0)
  })
})

describe('runSimulation — Off-plan, Hold', () => {
  it('Emaar: fully paid off and worth exactly the property price at handover (year 3)', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'EMAAR' })
    expect(data[2].buyerNetWorth).toBe(1000000)
    expect(data[2].renterNetWorth).toBe(1000000)
  })

  it('Damac: fully paid off and worth exactly the property price at handover (year 3)', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DAMAC' })
    expect(data[2].buyerNetWorth).toBe(1000000)
  })

  it('Danube: still owes 44% at handover, so net worth is only the 56% actually paid in (cash/uncommitted excluded)', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE' })
    expect(data[2].buyerNetWorth).toBe(560000)
    expect(data[2].buyerCashPortion).toBeCloseTo(440000, 0) // still tracked, just not counted
  })

  it('Danube: rental yield income offsets the residual float, but that float stays outside Buyer Net Worth', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE', rentalYield: 6 })
    // Fully paid off by month 80 (56% by handover + 44% over the next 44 months) -> cost-basis equity
    // reaches the full 1,000,000 with 0% appreciation; the 220,000 rental-income-offset leftover (see the
    // prior version of this test) is real money, tracked in buyerCashPortion, but no longer part of net worth.
    expect(data[6].buyerNetWorth).toBe(1000000) // year 7 = month 84, 4 months after month 80 payoff
    expect(data[6].buyerCashPortion).toBeCloseTo(220000, 0)
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

  it('Off-Plan Flip: still charged — it was already paid at booking, before the flip decision', () => {
    const withFee = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      homeAppreciation: 10,
      dldFeePct: 4,
    })
    const noFee = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      homeAppreciation: 10,
      dldFeePct: 0,
    })
    expect(noFee.data[2].buyerNetWorth - withFee.data[2].buyerNetWorth).toBeCloseTo(40000, 0)
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

  it('a waiver also reduces what the flipper already sunk into the fee', () => {
    const full = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      homeAppreciation: 10,
      dldFeePct: 4,
      dldWaiverPct: 0,
    })
    const waived = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      homeAppreciation: 10,
      dldFeePct: 4,
      dldWaiverPct: 100,
    })
    expect(waived.data[2].buyerNetWorth - full.data[2].buyerNetWorth).toBeCloseTo(40000, 0)
  })
})

describe('runSimulation — Off-plan, Flip Before Handover', () => {
  it('matches the spec formulas for V36, cashRealized, and profit (tax-free)', () => {
    const { data } = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    const v36 = 1000000 * 1.1 ** 3
    const remainingObligation = 216666.6666667 // Emaar's month-36 due amount (20% lump + last installment)
    const cashRealized = v36 - remainingObligation
    expect(data[2].buyerNetWorth).toBeCloseTo(cashRealized, 0)
  })

  it('CAGR is annualized over the 3-year hold, on only the capital actually paid in (leveraged)', () => {
    const { data, flipCAGR } = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      developerPlan: 'EMAAR',
      exitStrategy: 'FLIP',
    })
    const investedSoFar = 1000000 - 216666.6666667 // paid in through month 35, excluding the skipped handover milestone
    const expectedCAGR = (data[2].buyerNetWorth / investedSoFar) ** (1 / 3) - 1
    expect(flipCAGR).toBeCloseTo(expectedCAGR, 6)
    expect(flipCAGR).toBeGreaterThan(0.1) // sanity: leveraged return exceeds the 10% raw appreciation rate
  })

  it('flipCAGR is null for a Ready property or an Off-Plan Hold', () => {
    expect(runSimulation(base).flipCAGR).toBeNull()
    expect(runSimulation({ ...base, propertyStatus: 'OFFPLAN', exitStrategy: 'HOLD' }).flipCAGR).toBeNull()
  })

  it('a flipped contract loses its primary-residence exemption — US flat 15%, no $250K exemption', () => {
    const free = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      citizenship: 'UAE/Other',
      taxResidence: 'UAE',
    })
    const us = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      citizenship: 'USA',
      taxResidence: 'UAE',
    })
    const profit = 1000000 * 1.1 ** 3 - 1000000
    expect(free.data[2].buyerNetWorth - us.data[2].buyerNetWorth).toBeCloseTo(profit * 0.15, 0)
  })

  it('UK flip tax uses the 20% rate (same as the stock drag rate), unlike a 0% held exit', () => {
    const uk = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      citizenship: 'UK',
      taxResidence: 'UK',
    })
    const free = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      citizenship: 'UAE/Other',
      taxResidence: 'UAE',
    })
    const profit = 1000000 * 1.1 ** 3 - 1000000
    expect(free.data[2].buyerNetWorth - uk.data[2].buyerNetWorth).toBeCloseTo(profit * 0.2, 0)
  })

  it('after flipping, the buyer path simply compounds and no longer tracks home equity', () => {
    const { data } = runSimulation({
      ...base,
      homeAppreciation: 10,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      stockReturn: 8,
    })
    expect(data[29].buyerNetWorth).toBeGreaterThan(data[2].buyerNetWorth)
  })
})

describe('runSimulation — equity vs appreciation breakdown', () => {
  // Buyer Net Worth is strictly Cost-Basis Equity + Appreciation Gain —
  // Cash/Uncommitted is tracked (for the breakdown chart) but deliberately
  // excluded, since it's idle capital, not realized property value. Not
  // true for a flip, where the cash IS the realized, cashed-out value —
  // see the dedicated Flip test below instead.
  // Precision -1 (tolerance < 5) absorbs the +/-1-2 AED drift from rounding
  // each component independently, vs. rounding the total once.
  const equityPlusAppreciationEqualsNetWorth = (row) =>
    expect(row.buyerCostBasisEquity + row.buyerAppreciationGain).toBeCloseTo(row.buyerNetWorth, -1)

  it('Ready, mortgaged, with appreciation and a US exit tax: equity + appreciation always equal net worth', () => {
    const { data } = runSimulation({
      ...base,
      downPaymentPct: 20,
      homeAppreciation: 8,
      citizenship: 'USA',
      taxResidence: 'UAE',
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
    const { data } = runSimulation({ ...base, homeAppreciation: 10 })
    expect(data[2].buyerCostBasisEquity).toBe(1000000) // fully paid, no mortgage
    // Year 3 (month 36) has had 3 annual step-ups (months 1, 13, 25 —
    // appreciation starts immediately, unlike rent/cost inflation).
    expect(data[2].buyerAppreciationGain).toBeCloseTo(1000000 * 1.1 ** 3 - 1000000, 0)
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('Off-Plan construction: cost-basis equity is what has actually been paid to the developer', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'EMAAR', homeAppreciation: 10 })
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
      homeAppreciation: 20,
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
      homeAppreciation: 6,
      rentalYield: 6,
    })
    data.forEach(equityPlusAppreciationEqualsNetWorth)
  })

  it('Flip year: the payout is attributed back to equity paid in vs. appreciation gain, not dumped into cash', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      homeAppreciation: 10,
    })
    const paidByMonth35 = 1000000 - 216666.6666667 // same Emaar figure used elsewhere in this file
    const v36 = 1000000 * 1.1 ** 3
    const profit = v36 - 1000000
    expect(data[2].buyerCostBasisEquity).toBeCloseTo(paidByMonth35, 0) // base has 0% dld fee, 0% flip tax
    expect(data[2].buyerAppreciationGain).toBeCloseTo(profit, 0)
    expect(data[2].buyerCashPortion).toBe(0)
    equityPlusAppreciationEqualsNetWorth(data[2])
  })

  it('Post-flip years (if ever shown) revert to pure cash, since the payout is now just a stock portfolio', () => {
    const { data } = runSimulation({
      ...base,
      propertyStatus: 'OFFPLAN',
      exitStrategy: 'FLIP',
      homeAppreciation: 10,
      stockReturn: 8,
    })
    expect(data[3].buyerCostBasisEquity).toBe(0)
    expect(data[3].buyerAppreciationGain).toBe(0)
    expect(data[3].buyerCashPortion).toBe(data[3].buyerNetWorth)
  })
})

describe('runSimulation — appreciation modifiers', () => {
  it('villa defaults appreciate faster than condo when using the asset-class default', () => {
    const condo = runSimulation({ ...base, assetClass: 'CONDO', homeAppreciation: 11 })
    const villa = runSimulation({ ...base, assetClass: 'VILLA', homeAppreciation: 20 })
    expect(villa.data[10].homeValue).toBeGreaterThan(condo.data[10].homeValue)
  })

  it('infrastructure bonuses increase appreciation beyond the base slider', () => {
    const plain = runSimulation({ ...base, homeAppreciation: 5 })
    const withMetro = runSimulation({ ...base, homeAppreciation: 5, nearMetro: true })
    const withBoth = runSimulation({ ...base, homeAppreciation: 5, nearMetro: true, nearAirport: true })
    expect(withMetro.data[5].homeValue).toBeGreaterThan(plain.data[5].homeValue)
    expect(withBoth.data[5].homeValue).toBeGreaterThan(withMetro.data[5].homeValue)
  })
})
