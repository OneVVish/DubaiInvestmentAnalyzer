import { resolveTaxProfile, getNetStockReturn } from './taxEngine.js'
import { buildMilestoneSchedule, amountDueInMonth, cumulativePaidByMonth, HANDOVER_MONTH } from './paymentPlans.js'
import { AED_PER_USD } from './currency.js'
import { computeAnnualServiceCharges } from './serviceCharges.js'

export const YEARS = 30
export const MONTHS = YEARS * 12

export const ASSET_CLASS_APPRECIATION_DEFAULTS = { CONDO: 11, VILLA: 20 }
export const ASSET_CLASS_SIZE_DEFAULTS = { CONDO: 1200, VILLA: 3500 }
export const METRO_BONUS_PCT = 1.5
export const AIRPORT_BONUS_PCT = 2.5

// Standard amortized fixed-rate monthly payment.
export function calculateMortgagePayment(loanAmount, annualRate, termMonths) {
  const monthlyRate = annualRate / 100 / 12
  if (monthlyRate === 0) return loanAmount / termMonths
  const factor = Math.pow(1 + monthlyRate, termMonths)
  return (loanAmount * monthlyRate * factor) / (factor - 1)
}

// Infrastructure bonuses are additive on top of whatever the appreciation
// slider currently reads, computed here rather than mutating the slider —
// the UI shows this as a derived "effective rate," not a rewritten input.
export function getEffectiveAppreciation(inputs) {
  let rate = inputs.homeAppreciation
  if (inputs.nearMetro) rate += METRO_BONUS_PCT
  if (inputs.nearAirport) rate += AIRPORT_BONUS_PCT
  return rate
}

// Primary-residence exit tax on a Ready or held-to-handover property. The US
// $250K exemption is USD-denominated; since everything else here is AED,
// converting just for this comparison (then back) is necessary.
function computeHoldExitTax(profit, taxProfile) {
  if (profit <= 0) return 0
  let taxableProfit = profit
  if (taxProfile.exemptionUSD) {
    const profitUSD = profit / AED_PER_USD
    taxableProfit = Math.max(0, profitUSD - taxProfile.exemptionUSD) * AED_PER_USD
  }
  return taxableProfit * (taxProfile.exitTaxPct / 100)
}

// A flipped off-plan contract was never occupied, so no citizenship keeps a
// primary-residence exemption — flat rate, no exemption, on the full profit.
function computeFlipExitTax(profit, taxProfile) {
  if (profit <= 0) return 0
  return profit * (taxProfile.flipExitTaxPct / 100)
}

export function runSimulation(inputs) {
  const {
    propertyPrice,
    monthlyRent,
    rentInflation,
    rentalYield,
    propertyStatus, // 'READY' | 'OFFPLAN'
    developerPlan, // 'EMAAR' | 'DAMAC' | 'DANUBE' — off-plan only
    exitStrategy, // 'HOLD' | 'FLIP' — off-plan only
    downPaymentPct, // Ready only
    mortgageRate, // Ready only
    mortgageTermYears, // Ready only
    propertySizeSqft,
    serviceChargeRate,
    homeInsuranceAnnual,
    yearlyMaintenance,
    costInflation,
    sellingCostPct,
    dldFeePct,
    dldWaiverPct, // 0, 50, or 100 — a developer promotion covering part/all of the fee
    stockReturn,
    citizenship,
    taxResidence,
  } = inputs

  const taxProfile = resolveTaxProfile(citizenship, taxResidence)
  const netStockReturn = getNetStockReturn(stockReturn, taxProfile)
  const monthlyNetStockReturn = Math.pow(1 + netStockReturn / 100, 1 / 12) - 1
  const effectiveAppreciation = getEffectiveAppreciation(inputs)
  const monthlyMortgageRate = mortgageRate / 100 / 12

  const isOffPlan = propertyStatus === 'OFFPLAN'
  const isFlip = isOffPlan && exitStrategy === 'FLIP'
  const schedule = isOffPlan ? buildMilestoneSchedule(developerPlan, propertyPrice) : []

  // The Buyer's actual month-0 own-cash outlay — for Ready, the down payment
  // (the rest is borrowed); for Off-Plan, the 20% booking fee (there's no
  // mortgage off-plan in this model; the remaining 80% is the buyer's own
  // money, just not yet due). This is also the Renter's starting capital —
  // the same "same starting cash, then diverging" comparison RentVsBuy uses,
  // generalized to off-plan's staged payments below.
  const downPayment = isOffPlan ? propertyPrice * 0.2 : propertyPrice * (downPaymentPct / 100)
  const loanAmount = isOffPlan ? 0 : propertyPrice - downPayment
  const mortgagePayment =
    !isOffPlan && loanAmount > 0 ? calculateMortgagePayment(loanAmount, mortgageRate, mortgageTermYears * 12) : 0

  // DLD (Dubai Land Department) transfer fee — paid once, at booking (month
  // 0), for both Ready and Off-Plan (off-plan registers it upfront via
  // Oqood, not at handover). `dldWaiverPct` models a developer promotion
  // that covers part or all of it (a common Dubai sales incentive).
  const effectiveDldFeePct = dldFeePct * (1 - dldWaiverPct / 100)
  const dldFee = propertyPrice * (effectiveDldFeePct / 100)

  let homeValue = propertyPrice
  let loanBalance = loanAmount
  let rent = monthlyRent
  // Community × size drives the actual charge, not a flat guess — see
  // serviceCharges.js (rates sourced from a Dubai service-charges guide).
  let serviceCharges = computeAnnualServiceCharges(propertySizeSqft, serviceChargeRate) / 12
  let insurance = homeInsuranceAnnual
  let maintenance = yearlyMaintenance

  // The Buyer pays the DLD fee at booking (month 0), in both cases, so the
  // Renter's matching starting capital includes it from day one too.
  let renterPortfolio = downPayment + dldFee

  // Off-plan only: the not-yet-paid capital sitting in stocks, compounding,
  // drawn down as milestones (and, during construction, rent) come due. The
  // DLD fee is drawn from this same pool immediately, on top of the booking
  // payment — it's the buyer's own cash, not part of what's owed to the
  // developer.
  let buyerPool = isOffPlan ? propertyPrice - downPayment - dldFee : 0
  let paidToDeveloper = isOffPlan ? downPayment : propertyPrice
  let handoverDone = false
  let flipExecuted = false
  let flipPortfolio = 0
  let flipCAGR = null
  // The flip year's own equity/appreciation lineage, captured once at the
  // moment of the flip (see below) — used only for that one year's
  // breakdown row. Every year after, the proceeds are just cash (see the
  // snapshot logic further down).
  let flipEquityAtFlip = 0
  let flipAppreciationAtFlip = 0

  const data = []

  for (let month = 1; month <= MONTHS; month++) {
    // Home appreciation starts compounding from month 1 (year 1 already
    // reflects a year of growth) — deliberately on a different schedule
    // than rent/cost inflation below, which still wait a full year before
    // their first step.
    if ((month - 1) % 12 === 0) {
      homeValue *= 1 + effectiveAppreciation / 100
    }
    if (month > 1 && (month - 1) % 12 === 0) {
      rent *= 1 + rentInflation / 100
      serviceCharges *= 1 + costInflation / 100
      insurance *= 1 + costInflation / 100
      maintenance *= 1 + costInflation / 100
    }

    const monthlyCarryingCosts = serviceCharges + insurance / 12 + maintenance / 12

    // buyerCostThisMonth feeds the Renter-delta below: whatever the Buyer
    // actually spends (or nets, after any offsetting income) that month,
    // compared against the Renter's rent. `null` only once flipped — from
    // then on the Buyer-path is a standalone portfolio with no further cost
    // to mirror (they stop paying rent too, per spec).
    let buyerCostThisMonth = 0

    if (flipExecuted) {
      flipPortfolio *= 1 + monthlyNetStockReturn
    } else if (isOffPlan && !handoverDone) {
      const isFlipMonth = isFlip && month === HANDOVER_MONTH
      if (isFlipMonth) {
        // Never pay the handover-triggering milestone — sell the contract
        // instead. V36 is computed directly from the spec's closed-form
        // formula (equivalent to the iterative `homeValue` by this point,
        // since appreciation has stepped 3 times by month 36) rather than
        // relying on loop state.
        const v36 = propertyPrice * (1 + effectiveAppreciation / 100) ** 3
        const paidToDeveloperSoFar = cumulativePaidByMonth(schedule, HANDOVER_MONTH - 1)
        const remainingObligation = propertyPrice - paidToDeveloperSoFar
        const cashRealized = v36 - remainingObligation
        const profit = v36 - propertyPrice
        const flipTax = computeFlipExitTax(profit, taxProfile)
        // The DLD fee was already paid at booking regardless of what happens
        // at handover — it doesn't come back just because the buyer flips
        // instead of taking title.
        flipPortfolio = cashRealized - flipTax - dldFee
        flipExecuted = true
        buyerCostThisMonth = 0 // no rent/milestone this month — the sale replaces it

        // Where the flip payout actually came from — principal paid in
        // (net of the DLD fee, also cash sunk into this deal) vs. the
        // appreciation gain (net of the flip's own tax). These sum exactly
        // to flipPortfolio: paidToDeveloperSoFar + (v36 - propertyPrice) -
        // dldFee - flipTax = (v36 - remainingObligation) - flipTax - dldFee.
        flipEquityAtFlip = paidToDeveloperSoFar - dldFee
        flipAppreciationAtFlip = profit - flipTax

        // Annualized return on total cash actually committed by handover —
        // developer milestones plus the DLD fee — not the full price. A
        // leveraged figure, since the staged schedule means only part of the
        // price was ever at risk for the 3-year hold.
        const investedSoFar = paidToDeveloperSoFar + dldFee
        flipCAGR = investedSoFar > 0 ? (flipPortfolio / investedSoFar) ** (1 / 3) - 1 : null
      } else {
        const milestoneDue = amountDueInMonth(schedule, month)
        buyerPool = buyerPool * (1 + monthlyNetStockReturn) - milestoneDue
        paidToDeveloper += milestoneDue
        // The buyer doesn't have a home yet during construction, so they
        // also pay their own rent — out of the same float.
        const rentDuringConstruction = month <= HANDOVER_MONTH ? rent : 0
        buyerPool -= rentDuringConstruction
        buyerCostThisMonth = milestoneDue + rentDuringConstruction

        if (month === HANDOVER_MONTH) handoverDone = true
      }
    } else if (isOffPlan && handoverDone) {
      // Possession transferred. Emaar/Damac are fully paid off by now — this
      // branch is only ever financially active for Danube's remaining
      // 1%/month installments (months 37–80), offset by imputed rental
      // income per spec. Carrying costs flow through buyerCostThisMonth
      // (mirroring Ready property), not through buyerPool — buyerPool here
      // is purely the leftover, never-needed float, or Danube's residual
      // developer-financing arrangement.
      const developerInstallment = amountDueInMonth(schedule, month)
      const rentalIncomeCredit = developerInstallment > 0 ? (rentalYield / 100) * homeValue / 12 : 0
      buyerPool = buyerPool * (1 + monthlyNetStockReturn) - developerInstallment + rentalIncomeCredit
      paidToDeveloper += developerInstallment
      buyerCostThisMonth = developerInstallment - rentalIncomeCredit + monthlyCarryingCosts
    } else {
      // Ready property — mortgage-financed, exactly like a standard Buyer.
      let actualMortgagePayment = 0
      if (loanBalance > 0) {
        const interestPayment = loanBalance * monthlyMortgageRate
        const principalPayment = Math.min(loanBalance, mortgagePayment - interestPayment)
        loanBalance -= principalPayment
        actualMortgagePayment = interestPayment + principalPayment
      }
      buyerCostThisMonth = actualMortgagePayment + monthlyCarryingCosts
    }

    // Renter always pays their own rent every month, regardless of what the
    // Buyer is doing; buyerCostThisMonth (0 once flipped) is the offsetting
    // contribution mirroring whatever the Buyer spends on the property that
    // month — applied bidirectionally, same convention as RentVsBuy.
    renterPortfolio *= 1 + monthlyNetStockReturn
    renterPortfolio += buyerCostThisMonth - rent

    if (month % 12 === 0) {
      const year = month / 12
      let buyerNetWorth
      // - costBasisEquity: principal actually paid in so far (mortgage
      //   paydown, or developer milestones), at the ORIGINAL price — not
      //   touched by price growth, selling costs, or exit tax.
      // - appreciationGainNet: the price-growth portion, net of exit tax and
      //   selling costs (those are charged against the gain, not the
      //   principal — matches how the exit tax itself is already computed,
      //   on profit alone). Proportional to costBasisEquity while off-plan
      //   construction is still in progress (you only own a fraction of the
      //   gain until you've paid that same fraction of the price).
      // - cashPortion: capital not tied up in the property — the off-plan
      //   float (pre-handover, or Danube's post-handover residual). Tracked
      //   for the breakdown chart but deliberately excluded from
      //   buyerNetWorth below — it's idle capital, not realized property
      //   value, until either the property is fully owned (folds into
      //   appreciation/equity naturally) or the deal is flipped (see below).
      let costBasisEquity
      let appreciationGainNet
      let cashPortion

      if (flipExecuted && month === HANDOVER_MONTH) {
        // The flip year itself: show where the payout actually came from
        // (equity paid in vs. appreciation gain) rather than dumping it
        // all into an opaque "cash" bucket — the whole point of a flip is
        // converting property gains into cash, not that those gains never
        // existed.
        buyerNetWorth = flipPortfolio
        costBasisEquity = flipEquityAtFlip
        appreciationGainNet = flipAppreciationAtFlip
        cashPortion = 0
      } else if (flipExecuted) {
        // Any year after the flip: now it's just a generic reinvested
        // stock portfolio, fully disconnected from real estate — no equity
        // or appreciation left to attribute.
        buyerNetWorth = flipPortfolio
        costBasisEquity = 0
        appreciationGainNet = 0
        cashPortion = flipPortfolio
      } else if (isOffPlan && !handoverDone) {
        const appreciationGain = homeValue - propertyPrice
        costBasisEquity = paidToDeveloper
        appreciationGainNet = paidToDeveloper * (appreciationGain / propertyPrice)
        cashPortion = buyerPool
        buyerNetWorth = costBasisEquity + appreciationGainNet
      } else {
        // Ready, or off-plan post-handover — both are now a straightforward
        // owned home: value if sold this year, net of selling costs, any
        // remaining developer/mortgage balance, and the exit tax.
        const remainingBalance = isOffPlan ? Math.max(0, propertyPrice - paidToDeveloper) : loanBalance
        const appreciationGain = homeValue - propertyPrice
        const exitTax = computeHoldExitTax(appreciationGain, taxProfile)
        costBasisEquity = propertyPrice - remainingBalance
        appreciationGainNet = appreciationGain - exitTax - homeValue * (sellingCostPct / 100)
        cashPortion = isOffPlan ? buyerPool : 0
        buyerNetWorth = costBasisEquity + appreciationGainNet
      }

      data.push({
        year,
        buyerNetWorth: Math.round(buyerNetWorth),
        renterNetWorth: Math.round(renterPortfolio),
        homeValue: Math.round(homeValue),
        buyerCostBasisEquity: Math.round(costBasisEquity),
        buyerAppreciationGain: Math.round(appreciationGainNet),
        buyerCashPortion: Math.round(cashPortion),
      })
    }
  }

  const breakEvenPoint = data.find((d) => d.buyerNetWorth > d.renterNetWorth)

  return {
    data,
    mortgagePayment,
    downPayment,
    breakEvenYear: breakEvenPoint ? breakEvenPoint.year : null,
    flipCAGR,
  }
}
