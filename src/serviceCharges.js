// AED per sq ft per year, taken as the midpoint of each community's quoted
// range (https://www.luxhabitat.ae/the-journal/dubai-service-charges-guide/).
// A community missing here (or "Other / Custom") returns null — the rate
// slider stays wherever it was rather than being forced to a guess.
const SERVICE_CHARGE_RATES = {
  DOWNTOWN: 42.5,
  PALM: 19,
  MARINA: 16,
  DIFC: 20,
  HILLS: 20,
  JBR: 15.4,
  EMIRATES_HILLS: 1.6,
  CREEK_HARBOUR: 18.5,
  BUSINESS_BAY: 18.5,
  BLUEWATERS: 27.5,
  TILAL_AL_GHAF: 4,
  DAMAC_HILLS: 4.5,
  ARABIAN_RANCHES: 2.5,
}

export function getServiceChargeRate(communityKey) {
  return SERVICE_CHARGE_RATES[communityKey] ?? null
}

export function computeAnnualServiceCharges(propertySizeSqft, serviceChargeRate) {
  return propertySizeSqft * serviceChargeRate
}
