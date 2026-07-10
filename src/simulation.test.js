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
  monthlyServiceCharges: 0,
  homeInsuranceAnnual: 0,
  yearlyMaintenance: 0,
  costInflation: 0,
  sellingCostPct: 0,
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

  it('a UAE tax-free profile owes no exit tax on a large gain', () => {
    const { data } = runSimulation({ ...base, homeAppreciation: 50 })
    expect(data[2].homeValue).toBe(2250000)
    expect(data[2].buyerNetWorth).toBe(2250000) // full gain, no tax
  })

  it('a US citizen owes exit tax only on profit beyond the $250K USD exemption', () => {
    const { data } = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'USA', taxResidence: 'UAE' })
    const profitAED = 2250000 - 1000000
    const taxableUSD = Math.max(0, profitAED / AED_PER_USD - 250000)
    const expectedTax = taxableUSD * AED_PER_USD * 0.15
    expect(data[2].buyerNetWorth).toBeCloseTo(2250000 - expectedTax, 0)
    expect(expectedTax).toBeGreaterThan(0) // sanity: this scenario actually exceeds the exemption
  })

  it('UK and Canada residents owe zero exit tax even on a large gain (primary-residence relief)', () => {
    const uk = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'UK', taxResidence: 'UK' })
    const canada = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'UAE/Other', taxResidence: 'Canada' })
    expect(uk.data[2].buyerNetWorth).toBe(2250000)
    expect(canada.data[2].buyerNetWorth).toBe(2250000)
  })

  it('India owes exit tax on the full profit, with no exemption', () => {
    const { data } = runSimulation({ ...base, homeAppreciation: 50, citizenship: 'India', taxResidence: 'India' })
    const profitAED = 2250000 - 1000000
    const expectedTax = profitAED * 0.125
    expect(data[2].buyerNetWorth).toBeCloseTo(2250000 - expectedTax, 0)
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

  it('Danube: still owes 44% at handover, but net worth is still the property price at 0% rates', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE' })
    expect(data[2].buyerNetWorth).toBe(1000000)
  })

  it('Danube: rental yield income during the post-handover installment period is real, additional value', () => {
    const { data } = runSimulation({ ...base, propertyStatus: 'OFFPLAN', developerPlan: 'DANUBE', rentalYield: 6 })
    // Months 37-80: 44 months of (1% price installment) net of (6%/12 * price rental credit) = 5,000 net draw/month
    // against the 440,000 float remaining at handover -> 440,000 - 44*5,000 = 220,000 left over on top of the
    // now fully-paid, un-appreciated 1,000,000 property.
    expect(data[6].buyerNetWorth).toBe(1220000) // year 7 = month 84, 4 months after month 80 payoff
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
