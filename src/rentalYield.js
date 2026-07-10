// Dubai rental yields by community and asset class
// (https://www.engelvoelkers.com/ae/en/resources/rental-yield-dubai, Apr
// 2026 data). null = that community/asset-class combination isn't covered
// by the source; the yield slider stays wherever it was rather than being
// forced to a guess.
const RENTAL_YIELDS = {
  DOWNTOWN: { CONDO: 5.73, VILLA: null },
  PALM: { CONDO: null, VILLA: null },
  MARINA: { CONDO: 6.18, VILLA: null },
  DIFC: { CONDO: null, VILLA: null },
  HILLS: { CONDO: 6.35, VILLA: 4.98 },
  JBR: { CONDO: null, VILLA: null },
  EMIRATES_HILLS: { CONDO: null, VILLA: null },
  CREEK_HARBOUR: { CONDO: null, VILLA: null },
  BUSINESS_BAY: { CONDO: 6.77, VILLA: null },
  BLUEWATERS: { CONDO: null, VILLA: null },
  TILAL_AL_GHAF: { CONDO: null, VILLA: null },
  DAMAC_HILLS: { CONDO: null, VILLA: 5.38 },
  ARABIAN_RANCHES: { CONDO: null, VILLA: null },
  DUBAI_INVESTMENTS_PARK: { CONDO: 8.53, VILLA: null },
  SPORTS_CITY: { CONDO: 8.23, VILLA: null },
  SILICON_OASIS: { CONDO: 7.62, VILLA: null },
  JVC: { CONDO: 7.43, VILLA: 4.79 },
  DISCOVERY_GARDENS: { CONDO: 7.41, VILLA: null },
  JLT: { CONDO: 7.17, VILLA: null },
  JUMEIRAH_GOLF_ESTATES: { CONDO: null, VILLA: 5.66 },
  MBR_CITY: { CONDO: null, VILLA: 5.19 },
  VILLANOVA: { CONDO: null, VILLA: 5.04 },
  TOWN_SQUARE: { CONDO: null, VILLA: 4.97 },
  AL_FURJAN: { CONDO: null, VILLA: 4.86 },
}

// Overall Dubai average across all communities/property types, for context
// (average of 6.98% new-contract / 6.40% renewal-contract yields).
export const DUBAI_AVERAGE_YIELD_PCT = 6.68

export function getRentalYield(communityKey, assetClass) {
  return RENTAL_YIELDS[communityKey]?.[assetClass] ?? null
}

export function computeGrossYieldPct(annualRent, propertyPrice) {
  return (annualRent / propertyPrice) * 100
}
