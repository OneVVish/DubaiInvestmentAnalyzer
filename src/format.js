import { CURRENCIES, convertFromAED } from './currency.js'

// `amountAED` is always the underlying value computed by simulation.js;
// `currencyCode` only changes how it's displayed.
export function formatCurrency(amountAED, currencyCode = 'AED', compact = true) {
  const converted = convertFromAED(amountAED, currencyCode)
  const currency = CURRENCIES[currencyCode] ?? CURRENCIES.AED
  if (compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      notation: 'compact',
      maximumFractionDigits: 1,
      // Without this, whether "650000" renders as "$650K" or "$650.0K" depends
      // on the runtime's ICU data (observed differing between Node versions) —
      // pin it so the app renders identically everywhere.
      trailingZeroDisplay: 'stripIfInteger',
    }).format(converted)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.code,
    maximumFractionDigits: 0,
  }).format(converted)
}
