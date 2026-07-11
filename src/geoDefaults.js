// Visitor-location defaults for currency and Global Tax Profile — only the 5
// countries the app already models explicitly (its 5 supported currencies in
// currency.js, and the 4 tax profiles plus UAE in taxEngine.js). Anything
// else stays at today's defaults; no guess is better than the wrong one.
const GEO_DEFAULTS = {
  US: { currency: 'USD', citizenship: 'USA', taxResidence: 'USA' },
  GB: { currency: 'GBP', citizenship: 'UK', taxResidence: 'UK' },
  CA: { currency: 'CAD', citizenship: 'Canada', taxResidence: 'Canada' },
  IN: { currency: 'INR', citizenship: 'India', taxResidence: 'India' },
  AE: { currency: 'AED', citizenship: 'UAE/Other', taxResidence: 'UAE' },
}

export function getGeoDefaults(countryCode) {
  return GEO_DEFAULTS[countryCode] ?? null
}
