// Shared community list — referenced by both serviceCharges.js (cost side)
// and rentalYield.js (income side), since a property's community drives
// both. Not every community has data in both sources; each module falls
// back gracefully (see getServiceChargeRate / getRentalYield).
export const COMMUNITIES = [
  { key: 'DOWNTOWN', label: 'Downtown Dubai' },
  { key: 'PALM', label: 'Palm Jumeirah' },
  { key: 'MARINA', label: 'Dubai Marina' },
  { key: 'DIFC', label: 'DIFC' },
  { key: 'HILLS', label: 'Dubai Hills Estate' },
  { key: 'JBR', label: 'JBR' },
  { key: 'EMIRATES_HILLS', label: 'Emirates Hills' },
  { key: 'CREEK_HARBOUR', label: 'Dubai Creek Harbour' },
  { key: 'BUSINESS_BAY', label: 'Business Bay' },
  { key: 'BLUEWATERS', label: 'Bluewaters Island' },
  { key: 'TILAL_AL_GHAF', label: 'Tilal Al Ghaf' },
  { key: 'DAMAC_HILLS', label: 'DAMAC Hills' },
  { key: 'ARABIAN_RANCHES', label: 'Arabian Ranches' },
  { key: 'DUBAI_INVESTMENTS_PARK', label: 'Dubai Investments Park' },
  { key: 'SPORTS_CITY', label: 'Dubai Sports City' },
  { key: 'SILICON_OASIS', label: 'Dubai Silicon Oasis' },
  { key: 'JVC', label: 'Jumeirah Village Circle (JVC)' },
  { key: 'DISCOVERY_GARDENS', label: 'Discovery Gardens' },
  { key: 'JLT', label: 'Jumeirah Lake Towers (JLT)' },
  { key: 'JUMEIRAH_GOLF_ESTATES', label: 'Jumeirah Golf Estates' },
  { key: 'MBR_CITY', label: 'MBR City' },
  { key: 'VILLANOVA', label: 'Villanova' },
  { key: 'TOWN_SQUARE', label: 'Town Square' },
  { key: 'AL_FURJAN', label: 'Al Furjan' },
  { key: 'ARJAN', label: 'Arjan' },
  { key: 'THE_SPRINGS', label: 'The Springs' },
  { key: 'OTHER', label: 'Other / Custom' },
]
