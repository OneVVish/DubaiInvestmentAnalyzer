// Fixed conversion constants for *display* only — all computation in
// simulation.js happens in AED. Not live rates; AED_PER_USD is the real,
// stable official peg (since 1997); the other three are reasonable
// approximations, not fetched live.
export const AED_PER_USD = 3.6725
export const AED_PER_GBP = 4.7
export const AED_PER_CAD = 2.0
export const AED_PER_INR = 0.044

export const CURRENCIES = {
  AED: { code: 'AED', label: 'AED', aedPerUnit: 1 },
  USD: { code: 'USD', label: 'USD', aedPerUnit: AED_PER_USD },
  GBP: { code: 'GBP', label: 'GBP', aedPerUnit: AED_PER_GBP },
  CAD: { code: 'CAD', label: 'CAD', aedPerUnit: AED_PER_CAD },
  INR: { code: 'INR', label: 'INR', aedPerUnit: AED_PER_INR },
}

export function convertFromAED(amountAED, currencyCode) {
  const currency = CURRENCIES[currencyCode] ?? CURRENCIES.AED
  return amountAED / currency.aedPerUnit
}
