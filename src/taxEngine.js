export const CITIZENSHIP_OPTIONS = ['USA', 'UK', 'Canada', 'India', 'UAE/Other']
export const RESIDENCE_OPTIONS = ['UAE', 'USA', 'UK', 'Canada', 'India', 'Other']

// stockDragPct: annual haircut applied to the Renter's (and off-plan Buyer's
// construction-phase float) gross stock return, standing in for yearly tax
// drag on dividends/realized gains.
//
// exitTaxPct: tax on a Ready or held-to-handover property's sale profit,
// under primary-residence rules (the US figure carries a $250K USD
// exemption — see simulation.js, since converting it needs AED_PER_USD).
//
// flipExitTaxPct: tax on an off-plan "flip before handover" profit. No
// citizenship keeps a primary-residence exemption on a property that was
// never occupied, so this reuses the same rate as stockDragPct, per spec.
export const TAX_PROFILES = {
  US: {
    key: 'US',
    label: 'United States',
    stockDragPct: 15,
    exitTaxPct: 15,
    exemptionUSD: 250000,
    flipExitTaxPct: 15,
  },
  UK: {
    key: 'UK',
    label: 'United Kingdom',
    stockDragPct: 20,
    exitTaxPct: 0,
    flipExitTaxPct: 20,
  },
  CANADA: {
    key: 'CANADA',
    label: 'Canada',
    stockDragPct: 15,
    exitTaxPct: 0,
    flipExitTaxPct: 15,
  },
  INDIA: {
    key: 'INDIA',
    label: 'India',
    stockDragPct: 12.5,
    exitTaxPct: 12.5,
    flipExitTaxPct: 12.5,
  },
  FREE: {
    key: 'FREE',
    label: 'UAE / Tax-Free',
    stockDragPct: 0,
    exitTaxPct: 0,
    flipExitTaxPct: 0,
  },
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
