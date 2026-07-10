export const CITIZENSHIP_OPTIONS = ['USA', 'UK', 'Canada', 'India', 'UAE/Other']
export const RESIDENCE_OPTIONS = ['UAE', 'USA', 'UK', 'Canada', 'India', 'Other']

// stockDragPct: annual haircut applied to the Renter's (and off-plan Buyer's
// construction-phase float) gross stock return, standing in for yearly tax
// drag on dividends/realized gains.
//
// exitTaxPct: tax on a Ready or held-to-handover property's sale profit,
// under primary-residence rules (the US figure carries a $250K USD
// exemption — see simulation.js, since converting it needs AED_PER_USD).
// Only applies when the user marks the property an actual Personal Primary
// Residence — the default (renting it out, per this app's landlord
// framing) instead uses the user's own Capital Gains Tax Rate input (see
// DEFAULT_TAX_RATES/simulation.js), since primary-residence relief legally
// requires living there, not renting it out, and a generic fixed rate
// can't capture everyone's actual bracket.
export const TAX_PROFILES = {
  US: {
    key: 'US',
    label: 'United States',
    stockDragPct: 15,
    exitTaxPct: 15,
    exemptionUSD: 250000,
  },
  UK: {
    key: 'UK',
    label: 'United Kingdom',
    stockDragPct: 20,
    exitTaxPct: 0,
  },
  CANADA: {
    key: 'CANADA',
    label: 'Canada',
    stockDragPct: 15,
    exitTaxPct: 0,
  },
  INDIA: {
    key: 'INDIA',
    label: 'India',
    stockDragPct: 12.5,
    exitTaxPct: 12.5,
  },
  FREE: {
    key: 'FREE',
    label: 'UAE / Tax-Free',
    stockDragPct: 0,
    exitTaxPct: 0,
  },
}

// Default rate inputs per resolved profile, pre-filled at each country's
// own top/maximum bracket (a reasonable starting point — like the
// non-USD currency pegs in currency.js, these are reasonable
// approximations, not fetched live, and freely adjustable to the user's
// actual bracket):
// - US: 37% federal + 13.3% state (California, the highest state income
//   tax) on rental income; 23.8% capital gains (20% top LTCG + 3.8% NIIT).
// - UK: 45% Income Tax additional rate on rental income; 24% Capital
//   Gains Tax on residential property (the higher/additional rate, post
//   Oct-2024 Budget unification).
// - Canada: 33% federal + 25.75% provincial (Quebec, the highest
//   provincial rate) on rental income; capital gains taxed via a 50%
//   inclusion rate, so (33+25.75)*0.5 ≈ 29.4%.
// - India: 30% top income-tax slab on rental income (headline rate,
//   excluding surcharge/cess); 12.5% LTCG on immovable property (flat,
//   no indexation, post the July-2024 Budget change).
// - FREE (UAE/Other): no income or capital gains tax.
// marginalTaxRateFed/State apply to US/Canada (their two-tier income tax
// systems); marginalTaxRateSingle applies to UK/India (one national
// rate) — see computeRentalIncomeTaxPct. capitalGainsTaxRatePct applies
// uniformly to whichever profile is active — see simulation.js.
export const DEFAULT_TAX_RATES = {
  US: { marginalTaxRateFed: 37, marginalTaxRateState: 13.3, marginalTaxRateSingle: 0, capitalGainsTaxRatePct: 23.8 },
  UK: { marginalTaxRateFed: 0, marginalTaxRateState: 0, marginalTaxRateSingle: 45, capitalGainsTaxRatePct: 24 },
  CANADA: { marginalTaxRateFed: 33, marginalTaxRateState: 25.75, marginalTaxRateSingle: 0, capitalGainsTaxRatePct: 29.4 },
  INDIA: { marginalTaxRateFed: 0, marginalTaxRateState: 0, marginalTaxRateSingle: 30, capitalGainsTaxRatePct: 12.5 },
  FREE: { marginalTaxRateFed: 0, marginalTaxRateState: 0, marginalTaxRateSingle: 0, capitalGainsTaxRatePct: 0 },
}

// US citizenship carries US tax exposure regardless of where you live, so it
// takes priority over Tax Residence — a US citizen resident in the UK is
// still US-taxable, not UK-taxable. Only once citizenship isn't USA does
// Tax Residence decide the profile.
export function resolveTaxProfile(citizenship, residence) {
  if (citizenship === 'USA' || residence === 'USA') return TAX_PROFILES.US
  if (residence === 'UK') return TAX_PROFILES.UK
  if (residence === 'Canada') return TAX_PROFILES.CANADA
  if (residence === 'India') return TAX_PROFILES.INDIA
  return TAX_PROFILES.FREE
}

export function getNetStockReturn(stockReturn, profile) {
  return stockReturn * (1 - profile.stockDragPct / 100)
}

// Rental income (net of the mortgage/installment and carrying costs) is
// real ordinary income, taxed at the landlord's own marginal rate — not
// stockDragPct, which only proxies tax drag on stock dividends/capital
// gains. US and Canada split into Federal + State/Provincial (their own
// two-tier income tax systems); UK and India use a single national
// marginal rate; UAE/Other stays untaxed regardless of the rate inputs,
// since there's no rental income tax to apply them to.
export function computeRentalIncomeTaxPct(inputs, taxProfile) {
  if (taxProfile.key === 'US' || taxProfile.key === 'CANADA') {
    return (inputs.marginalTaxRateFed || 0) + (inputs.marginalTaxRateState || 0)
  }
  if (taxProfile.key === 'UK' || taxProfile.key === 'INDIA') {
    return inputs.marginalTaxRateSingle || 0
  }
  return 0
}
