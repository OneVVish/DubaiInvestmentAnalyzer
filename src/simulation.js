import { resolveTaxProfile, getNetStockReturn, computeRentalIncomeTaxPct } from './taxEngine.js'
import {
  buildMilestoneSchedule,
  amountDueInMonth,
  cumulativePaidByMonth,
  HANDOVER_MONTH,
  PAYMENT_PLANS,
} from './paymentPlans.js'
import { AED_PER_USD } from './currency.js'
import { computeAnnualServiceCharges } from './serviceCharges.js'
import { computeAnnualizedIRR } from './irr.js'

export const YEARS = 30
export const MONTHS = YEARS * 12

// Pre-handover defaults vary by asset class — off-plan construction-phase
// appreciation in Dubai is commonly quoted higher than the secondary
// market (scarcity/pre-launch pricing), though the 2026 market has
// moderated well off the 12-22% annual growth seen in 2024-25. Post-
// handover defaults are also split by asset class — villas have
// consistently outperformed apartments even on the completed/secondary
// market (~9-10% vs ~5-6% YoY as of 2026), so a single flat rate for both
// understates villas' real advantage.
export const ASSET_CLASS_APPRECIATION_DEFAULTS = { CONDO: 8, VILLA: 12 }
export const ASSET_CLASS_POSTHANDOVER_APPRECIATION_DEFAULTS = { CONDO: 5, VILLA: 9 }
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
// Applied to both phases: a Metro/Airport expansion affects the location's
// fundamental value regardless of when you take possession.
export function getEffectivePreHandoverAppreciation(inputs) {
  let rate = inputs.preHandoverAppreciation
  if (inputs.nearMetro) rate += METRO_BONUS_PCT
  if (inputs.nearAirport) rate += AIRPORT_BONUS_PCT
  return rate
}

export function getEffectivePostHandoverAppreciation(inputs) {
  let rate = inputs.postHandoverAppreciation
  if (inputs.nearMetro) rate += METRO_BONUS_PCT
  if (inputs.nearAirport) rate += AIRPORT_BONUS_PCT
  return rate
}

// Exit tax on a Ready or held-to-handover property. Primary-residence
// relief (the US $250K USD exemption, UK/Canada's 0% rates) legally
// requires actually living there — it does NOT apply to a rental, which is
// this app's default framing (Buying collects rent throughout). So unless
// the user explicitly marks it a Personal Primary Residence, this uses the
// user's own Capital Gains Tax Rate input, with no exemption — only the
// opt-in path applies exitTaxPct/exemptionUSD.
function computeHoldExitTax(profit, taxProfile, isPrimaryResidence, capitalGainsTaxRatePct) {
  if (profit <= 0) return 0
  if (!isPrimaryResidence) {
    return profit * (capitalGainsTaxRatePct / 100)
  }
  let taxableProfit = profit
  if (taxProfile.exemptionUSD) {
    const profitUSD = profit / AED_PER_USD
    taxableProfit = Math.max(0, profitUSD - taxProfile.exemptionUSD) * AED_PER_USD
  }
  return taxableProfit * (taxProfile.exitTaxPct / 100)
}

// A flipped off-plan contract was never occupied, so no citizenship keeps a
// primary-residence exemption — the user's own Capital Gains Tax Rate,
// flat, no exemption, on the full profit.
function computeFlipExitTax(profit, capitalGainsTaxRatePct) {
  if (profit <= 0) return 0
  return profit * (capitalGainsTaxRatePct / 100)
}

// Rental income is only taxed when it's actually a profit that month — a
// rental loss (negative cash flow) isn't taxed, matching how the exit-tax
// helpers above only ever tax positive profit.
function applyRentalIncomeTax(landlordCashFlow, rentalIncomeTaxPct) {
  const tax = landlordCashFlow > 0 ? landlordCashFlow * (rentalIncomeTaxPct / 100) : 0
  return landlordCashFlow - tax
}

export function runSimulation(inputs) {
  const {
    propertyPrice,
    monthlyRent,
    rentInflation,
    vacancyRatePct,
    propertyStatus, // 'READY' | 'OFFPLAN'
    developerPlan, // 'EMAAR' | 'DAMAC' | 'BALANCED_5050' | 'AGGRESSIVE_4060' | 'DANUBE' | 'DANUBE_CLASSIC' — off-plan only
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
    isPrimaryResidence,
    capitalGainsTaxRatePct,
  } = inputs

  const taxProfile = resolveTaxProfile(citizenship, taxResidence)
  const netStockReturn = getNetStockReturn(stockReturn, taxProfile)
  const monthlyNetStockReturn = Math.pow(1 + netStockReturn / 100, 1 / 12) - 1
  const rentalIncomeTaxPct = computeRentalIncomeTaxPct(inputs, taxProfile)
  const effectivePreHandoverAppreciation = getEffectivePreHandoverAppreciation(inputs)
  const effectivePostHandoverAppreciation = getEffectivePostHandoverAppreciation(inputs)
  const monthlyMortgageRate = mortgageRate / 100 / 12

  const isOffPlan = propertyStatus === 'OFFPLAN'
  const isFlip = isOffPlan && exitStrategy === 'FLIP'
  const schedule = isOffPlan ? buildMilestoneSchedule(developerPlan, propertyPrice) : []

  // The Buyer's actual month-0 own-cash outlay — for Ready, the down payment
  // (the rest is borrowed); for Off-Plan, the plan-specific booking fee
  // (20% for Emaar/Damac, 10% for Danube — there's no mortgage off-plan in
  // this model; the remainder is the buyer's own money, just not yet due).
  // This is also the Renter's starting capital — the same "same starting
  // cash, then diverging" comparison RentVsBuy uses, generalized to
  // off-plan's staged payments below.
  const downPayment = isOffPlan
    ? propertyPrice * (PAYMENT_PLANS[developerPlan].bookingPct / 100)
    : propertyPrice * (downPaymentPct / 100)
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

  // Rental profit, net of the property's own ownership cost (mortgage P&I,
  // or the off-plan developer installment) and carrying costs, reinvested
  // and compounding — a landlord's realized surplus (or deficit). Separate
  // from buyerPool, which tracks off-plan capital not yet deployed into
  // the property; this is already-earned rental cash, so it's INCLUDED in
  // Buyer Net Worth below (buyerPool/cashPortion stays excluded). Stays 0
  // during off-plan construction (nothing built/rentable yet) and for a
  // flipped contract (never occupied/rented at all).
  let landlordSurplus = 0

  const data = []
  // Monthly-granularity mirror of `data`, populated only for a Flip — its
  // whole story fits inside the 36-month construction window, where a
  // yearly snapshot (3 points) is too coarse to see the month-by-month
  // build-up of installments and appreciation. Hold/Ready stay purely
  // annual; this array stays empty for them.
  const flipMonthlyData = []

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
  // - landlordSurplusSnapshot: the accumulated rental profit tracked
  //   above — 0 during off-plan construction and for a flip (never
  //   rentable), otherwise INCLUDED in buyerNetWorth, since it's
  //   already-realized rental cash, not idle uncommitted capital.
  //
  // Reused by both the yearly `data` snapshot and the flip-only monthly
  // one below — same computation, different capture schedule.
  function buildSnapshot(month) {
    let buyerNetWorth
    let costBasisEquity
    let appreciationGainNet
    let cashPortion
    let landlordSurplusSnapshot = 0

    if (flipExecuted && month === HANDOVER_MONTH) {
      // The flip month itself: show where the payout actually came from
      // (equity paid in vs. appreciation gain) rather than dumping it
      // all into an opaque "cash" bucket — the whole point of a flip is
      // converting property gains into cash, not that those gains never
      // existed.
      buyerNetWorth = flipPortfolio
      costBasisEquity = flipEquityAtFlip
      appreciationGainNet = flipAppreciationAtFlip
      cashPortion = 0
    } else if (flipExecuted) {
      // Any period after the flip: now it's just a generic reinvested
      // stock portfolio, fully disconnected from real estate — no equity
      // or appreciation left to attribute.
      buyerNetWorth = flipPortfolio
      costBasisEquity = 0
      appreciationGainNet = 0
      cashPortion = flipPortfolio
    } else if (isOffPlan && !handoverDone) {
      // Full gain, not scaled by how much has been paid to the developer
      // so far — signing the SPA locks in the original price, so the
      // contract's worth if exited today is the property's current
      // market value minus whatever's still owed, same shape as the
      // Flip and post-handover branches (`cashRealized = v36 -
      // remainingObligation` = paidToDeveloperSoFar + fullAppreciationGain).
      // A leveraged figure by design: the less paid in so far, the more
      // the full gain amplifies the return on actual cash committed.
      const appreciationGain = homeValue - propertyPrice
      costBasisEquity = paidToDeveloper
      appreciationGainNet = appreciationGain
      cashPortion = buyerPool
      buyerNetWorth = costBasisEquity + appreciationGainNet
    } else {
      // Ready, or off-plan post-handover — both are now a straightforward
      // owned home: value if sold this year, net of selling costs, any
      // remaining developer/mortgage balance, and the exit tax.
      const remainingBalance = isOffPlan ? Math.max(0, propertyPrice - paidToDeveloper) : loanBalance
      const appreciationGain = homeValue - propertyPrice
      const exitTax = computeHoldExitTax(appreciationGain, taxProfile, isPrimaryResidence, capitalGainsTaxRatePct)
      costBasisEquity = propertyPrice - remainingBalance
      appreciationGainNet = appreciationGain - exitTax - homeValue * (sellingCostPct / 100)
      cashPortion = isOffPlan ? buyerPool : 0
      landlordSurplusSnapshot = landlordSurplus
      buyerNetWorth = costBasisEquity + appreciationGainNet + landlordSurplusSnapshot
    }

    return {
      buyerNetWorth: Math.round(buyerNetWorth),
      renterNetWorth: Math.round(renterPortfolio),
      homeValue: Math.round(homeValue),
      buyerCostBasisEquity: Math.round(costBasisEquity),
      buyerAppreciationGain: Math.round(appreciationGainNet),
      buyerCashPortion: Math.round(cashPortion),
      buyerLandlordSurplus: Math.round(landlordSurplusSnapshot),
    }
  }

  for (let month = 1; month <= MONTHS; month++) {
    // Home appreciation starts compounding from month 1 (year 1 already
    // reflects a year of growth) — deliberately on a different schedule
    // than rent/cost inflation below, which still wait a full year before
    // their first step. Pre-handover rate applies while off-plan
    // construction is still in progress; Ready properties (never off-plan)
    // always use the post-handover rate, since they have no construction
    // phase at all.
    if ((month - 1) % 12 === 0) {
      const rate = isOffPlan && !handoverDone ? effectivePreHandoverAppreciation : effectivePostHandoverAppreciation
      homeValue *= 1 + rate / 100
    }
    if (month > 1 && (month - 1) % 12 === 0) {
      rent *= 1 + rentInflation / 100
      serviceCharges *= 1 + costInflation / 100
      insurance *= 1 + costInflation / 100
      maintenance *= 1 + costInflation / 100
    }

    const monthlyCarryingCosts = serviceCharges + insurance / 12 + maintenance / 12
    // Vacancy reduces what the landlord actually collects, not what they
    // owe — a mortgage payment or service charge doesn't pause just
    // because the unit sits empty between tenants.
    const collectedRent = rent * (1 - vacancyRatePct / 100)

    // investingContribution feeds the Investing-side portfolio below: the
    // capital that would otherwise have gone into building home equity
    // this month (full mortgage P&I, or the off-plan developer
    // installment due) — a pure "same capital, different destination"
    // comparison. Rent plays no role on either side of this comparison;
    // Buying's rental economics are tracked separately, in landlordSurplus.
    let investingContribution = 0

    if (flipExecuted) {
      flipPortfolio *= 1 + monthlyNetStockReturn
    } else if (isOffPlan && !handoverDone) {
      const isFlipMonth = isFlip && month === HANDOVER_MONTH
      if (isFlipMonth) {
        // Never pay the handover-triggering milestone — sell the contract
        // instead. V36 is computed directly from the spec's closed-form
        // formula, using the pre-handover rate (equivalent to the iterative
        // `homeValue` by this point, since appreciation has stepped 3 times
        // by month 36, always at the pre-handover rate — a flip never
        // reaches handover) rather than relying on loop state.
        const v36 = propertyPrice * (1 + effectivePreHandoverAppreciation / 100) ** 3
        const paidToDeveloperSoFar = cumulativePaidByMonth(schedule, HANDOVER_MONTH - 1)
        const remainingObligation = propertyPrice - paidToDeveloperSoFar
        const cashRealized = v36 - remainingObligation
        const profit = v36 - propertyPrice
        const flipTax = computeFlipExitTax(profit, capitalGainsTaxRatePct)
        // The DLD fee was already paid at booking regardless of what happens
        // at handover — it doesn't come back just because the buyer flips
        // instead of taking title.
        flipPortfolio = cashRealized - flipTax - dldFee
        flipExecuted = true
        investingContribution = 0 // no milestone this month — the sale replaces it

        // Where the flip payout actually came from — principal paid in
        // (net of the DLD fee, also cash sunk into this deal) vs. the
        // appreciation gain (net of the flip's own tax). These sum exactly
        // to flipPortfolio: paidToDeveloperSoFar + (v36 - propertyPrice) -
        // dldFee - flipTax = (v36 - remainingObligation) - flipTax - dldFee.
        flipEquityAtFlip = paidToDeveloperSoFar - dldFee
        flipAppreciationAtFlip = profit - flipTax

        // Annualized return on invested capital, accounting for exactly
        // when each dollar went in — a true IRR, not a simple CAGR on the
        // total paid in. The booking fee and DLD fee land at month 0, then
        // one milestone outflow per month through month 35 (the schedule
        // already covers month 0 too), then the flip payout at month 36
        // (replacing that month's skipped milestone). A simple lump-sum
        // CAGR would understate this, since it treats every payment as if
        // it had the full 3 years to grow, when later installments really
        // only had a few months.
        const monthlyCashFlows = []
        for (let m = 0; m <= HANDOVER_MONTH; m++) {
          if (m === HANDOVER_MONTH) {
            monthlyCashFlows.push(flipPortfolio)
          } else {
            const due = amountDueInMonth(schedule, m)
            monthlyCashFlows.push(m === 0 ? -(due + dldFee) : -due)
          }
        }
        flipCAGR = computeAnnualizedIRR(monthlyCashFlows)
      } else {
        const milestoneDue = amountDueInMonth(schedule, month)
        buyerPool = buyerPool * (1 + monthlyNetStockReturn) - milestoneDue
        paidToDeveloper += milestoneDue
        investingContribution = milestoneDue
        // Nothing built/rentable yet during construction — no rent
        // collected, so landlordSurplus stays untouched (0) here.

        if (month === HANDOVER_MONTH) handoverDone = true
      }
    } else if (isOffPlan && handoverDone) {
      // Possession transferred. Emaar/Damac are fully paid off by now — this
      // branch is only ever financially active for Danube's remaining
      // 1%/month installments (months 37–80), funded from buyerPool — the
      // same pre-committed capital set aside at booking, already excluded
      // from Buyer Net Worth. Unlike a Ready mortgage (external bank
      // financing, paid from fresh cash each month, and split into
      // interest/principal), Danube's installment is 0%-interest and
      // funded from money the buyer already set aside — it must NOT also
      // be subtracted from landlordSurplus, or it double-charges the same
      // capital once via buyerPool's drawdown and again as a "landlord
      // expense." Only carrying costs are a genuinely new, unfunded
      // landlord expense here.
      const developerInstallment = amountDueInMonth(schedule, month)
      buyerPool = buyerPool * (1 + monthlyNetStockReturn) - developerInstallment
      paidToDeveloper += developerInstallment
      const landlordCashFlow = collectedRent - monthlyCarryingCosts
      landlordSurplus =
        landlordSurplus * (1 + monthlyNetStockReturn) + applyRentalIncomeTax(landlordCashFlow, rentalIncomeTaxPct)
      investingContribution = developerInstallment
    } else {
      // Ready property — mortgage-financed, exactly like a standard Buyer,
      // but now explicitly a landlord: rental income (net of vacancy) nets
      // against the mortgage payment and carrying costs each month.
      let actualMortgagePayment = 0
      if (loanBalance > 0) {
        const interestPayment = loanBalance * monthlyMortgageRate
        const principalPayment = Math.min(loanBalance, mortgagePayment - interestPayment)
        loanBalance -= principalPayment
        actualMortgagePayment = interestPayment + principalPayment
      }
      const landlordCashFlow = collectedRent - actualMortgagePayment - monthlyCarryingCosts
      landlordSurplus =
        landlordSurplus * (1 + monthlyNetStockReturn) + applyRentalIncomeTax(landlordCashFlow, rentalIncomeTaxPct)
      investingContribution = actualMortgagePayment
    }

    // Investing matches only the capital that would have built home
    // equity that month — no rent on either side of this comparison.
    renterPortfolio *= 1 + monthlyNetStockReturn
    renterPortfolio += investingContribution

    if (month % 12 === 0) {
      data.push({ year: month / 12, ...buildSnapshot(month) })
    }
    // Flip's whole story fits inside the 36-month construction window — a
    // yearly snapshot alone can't show the month-by-month build-up, so
    // capture every month through the flip itself, separately from `data`.
    if (isFlip && month <= HANDOVER_MONTH) {
      flipMonthlyData.push({ month, ...buildSnapshot(month) })
    }
  }

  const breakEvenPoint = data.find((d) => d.buyerNetWorth > d.renterNetWorth)

  return {
    data,
    flipMonthlyData,
    mortgagePayment,
    downPayment,
    breakEvenYear: breakEvenPoint ? breakEvenPoint.year : null,
    flipCAGR,
  }
}
