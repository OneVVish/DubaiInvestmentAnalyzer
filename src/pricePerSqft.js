// Dubai average price per sq ft by community and asset class
// (https://www.engelvoelkers.com/ae/en/resources/average-price-per-square-foot-in-dubai,
// June 2026 data). null = that community/asset-class combination isn't
// covered by the source; the Property Price default stays wherever it was
// rather than being forced to a guess — same convention as
// serviceCharges.js / rentalYield.js.
const PRICE_PER_SQFT = {
  PALM: { CONDO: 4240, VILLA: 8070 },
  DOWNTOWN: { CONDO: 3011, VILLA: null },
  CREEK_HARBOUR: { CONDO: 2600, VILLA: null },
  BUSINESS_BAY: { CONDO: 2547, VILLA: null },
  HILLS: { CONDO: 2432, VILLA: 2896 },
  MARINA: { CONDO: 2058, VILLA: null },
  JLT: { CONDO: 1831, VILLA: null },
  ARJAN: { CONDO: 1568, VILLA: null },
  JVC: { CONDO: 1510, VILLA: null },
  SPORTS_CITY: { CONDO: 1332, VILLA: null },
  JUMEIRAH_GOLF_ESTATES: { CONDO: null, VILLA: 2524 },
  ARABIAN_RANCHES: { CONDO: null, VILLA: 2417 },
  THE_SPRINGS: { CONDO: null, VILLA: 2306 },
  TILAL_AL_GHAF: { CONDO: null, VILLA: 2034 },
  DAMAC_HILLS: { CONDO: null, VILLA: 1908 },
}

// Dubai-wide averages by property type, for context (overall average across
// all types is AED 1,916/sq ft).
export const DUBAI_AVERAGE_PRICE_PER_SQFT = { CONDO: 1969, VILLA: 2241 }

export function getPricePerSqft(communityKey, assetClass) {
  return PRICE_PER_SQFT[communityKey]?.[assetClass] ?? null
}

export function computePropertyPrice(propertySizeSqft, pricePerSqft) {
  return propertySizeSqft * pricePerSqft
}
