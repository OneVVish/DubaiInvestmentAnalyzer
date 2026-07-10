// Handover — when the buyer takes possession — happens at month 36 for all
// six plans. Emaar and Damac are both fully paid off in a lump at handover;
// Balanced/Aggressive spread their back-end portion evenly over months
// after handover instead (their real-world defining feature, and Dubai's
// increasingly common post-handover structure); both Danube variants keep
// paying 1%/month well past handover too, just at different booking
// percentages (and therefore different payoff months).
export const HANDOVER_MONTH = 36

export const PAYMENT_PLANS = {
  EMAAR: { key: 'EMAAR', label: 'Traditional Emaar Premium (80/20)', bookingPct: 20 },
  DAMAC: { key: 'DAMAC', label: 'Damac Standard (60/40)', bookingPct: 20 },
  BALANCED_5050: { key: 'BALANCED_5050', label: 'The Balanced Post-Handover (50/50)', bookingPct: 20 },
  AGGRESSIVE_4060: { key: 'AGGRESSIVE_4060', label: 'The Aggressive Post-Handover (40/60)', bookingPct: 20 },
  DANUBE: { key: 'DANUBE', label: 'Danube "1% Monthly" (20% booking)', bookingPct: 20 },
  DANUBE_CLASSIC: { key: 'DANUBE_CLASSIC', label: 'Danube "1% Monthly" (10% booking)', bookingPct: 10 },
}

// Emaar, Damac, Balanced, and Aggressive all share the same shape (booking,
// a percentage spread evenly over the 36-month construction period, and a
// "handover" portion) — only the split, and whether that handover portion
// lands in one shot at month 36 (Emaar/Damac) or spreads across months
// after handover (Balanced/Aggressive), differs.
function buildSpreadPlusHandoverSchedule(propertyPrice, bookingPct, spreadPct, handoverLumpPct, postHandoverMonths = 0) {
  const schedule = [{ month: 0, amount: propertyPrice * (bookingPct / 100) }]
  const monthlyAmount = (propertyPrice * spreadPct) / 100 / HANDOVER_MONTH
  for (let month = 1; month <= HANDOVER_MONTH; month++) {
    schedule.push({ month, amount: monthlyAmount })
  }
  if (postHandoverMonths > 0) {
    // Balanced/Aggressive: the handover portion spreads evenly across the
    // months after handover instead of landing in one lump at month 36 —
    // cumulative payment through month 35 is unchanged either way, so this
    // only affects the post-handover trajectory, not pre-handover/Flip math.
    const postHandoverMonthlyAmount = (propertyPrice * handoverLumpPct) / 100 / postHandoverMonths
    for (let month = HANDOVER_MONTH + 1; month <= HANDOVER_MONTH + postHandoverMonths; month++) {
      schedule.push({ month, amount: postHandoverMonthlyAmount })
    }
  } else {
    // Emaar/Damac: due in a single lump exactly at handover, on top of that
    // month's regular installment.
    schedule[schedule.length - 1].amount += propertyPrice * (handoverLumpPct / 100)
  }
  return schedule
}

function buildDanubeSchedule(propertyPrice, bookingPct) {
  const schedule = [{ month: 0, amount: propertyPrice * (bookingPct / 100) }]
  const remainingMonths = Math.round((100 - bookingPct) / 1) // 1% of price per month
  for (let month = 1; month <= remainingMonths; month++) {
    schedule.push({ month, amount: propertyPrice * 0.01 })
  }
  return schedule
}

export function buildMilestoneSchedule(planKey, propertyPrice) {
  switch (planKey) {
    case 'EMAAR':
      return buildSpreadPlusHandoverSchedule(propertyPrice, PAYMENT_PLANS.EMAAR.bookingPct, 60, 20)
    case 'DAMAC':
      return buildSpreadPlusHandoverSchedule(propertyPrice, PAYMENT_PLANS.DAMAC.bookingPct, 40, 40)
    case 'BALANCED_5050':
      return buildSpreadPlusHandoverSchedule(propertyPrice, PAYMENT_PLANS.BALANCED_5050.bookingPct, 30, 50, 36)
    case 'AGGRESSIVE_4060':
      return buildSpreadPlusHandoverSchedule(propertyPrice, PAYMENT_PLANS.AGGRESSIVE_4060.bookingPct, 20, 60, 60)
    case 'DANUBE':
      return buildDanubeSchedule(propertyPrice, PAYMENT_PLANS.DANUBE.bookingPct)
    case 'DANUBE_CLASSIC':
      return buildDanubeSchedule(propertyPrice, PAYMENT_PLANS.DANUBE_CLASSIC.bookingPct)
    default:
      throw new Error(`Unknown payment plan: ${planKey}`)
  }
}

export function cumulativePaidByMonth(schedule, uptoMonth) {
  return schedule.filter((m) => m.month <= uptoMonth).reduce((sum, m) => sum + m.amount, 0)
}

export function amountDueInMonth(schedule, month) {
  return schedule.filter((m) => m.month === month).reduce((sum, m) => sum + m.amount, 0)
}
