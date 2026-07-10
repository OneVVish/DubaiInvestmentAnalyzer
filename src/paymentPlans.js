// Handover — when the buyer takes possession — happens at month 36 for all
// three plans. Danube's 1%/month installments continue well past that;
// Emaar is fully paid off at handover, while Damac's back-end lump is
// spread over months after handover (its real-world defining feature),
// not due in a single shot at handover.
export const HANDOVER_MONTH = 36

export const PAYMENT_PLANS = {
  EMAAR: { key: 'EMAAR', label: 'Emaar Premium (80/20)', bookingPct: 20 },
  DAMAC: { key: 'DAMAC', label: 'Damac (60/40, 24-mo post-handover)', bookingPct: 20 },
  DANUBE: { key: 'DANUBE', label: 'Danube "1% Monthly" (10% booking)', bookingPct: 10 },
}

// Emaar and Damac share the same shape (booking, a percentage spread evenly
// over the 36-month construction period, and a "handover" portion) — only
// the split, and whether that handover portion lands in one shot at month
// 36 or spreads across months after handover, differs.
function buildSpreadPlusHandoverSchedule(propertyPrice, bookingPct, spreadPct, handoverLumpPct, postHandoverMonths = 0) {
  const schedule = [{ month: 0, amount: propertyPrice * (bookingPct / 100) }]
  const monthlyAmount = (propertyPrice * spreadPct) / 100 / HANDOVER_MONTH
  for (let month = 1; month <= HANDOVER_MONTH; month++) {
    schedule.push({ month, amount: monthlyAmount })
  }
  if (postHandoverMonths > 0) {
    // Damac: the handover portion spreads evenly across the months after
    // handover instead of landing in one lump at month 36 — cumulative
    // payment through month 35 is unchanged either way, so this only
    // affects the post-handover trajectory, not pre-handover/Flip math.
    const postHandoverMonthlyAmount = (propertyPrice * handoverLumpPct) / 100 / postHandoverMonths
    for (let month = HANDOVER_MONTH + 1; month <= HANDOVER_MONTH + postHandoverMonths; month++) {
      schedule.push({ month, amount: postHandoverMonthlyAmount })
    }
  } else {
    // Emaar: due in a single lump exactly at handover, on top of that
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
      return buildSpreadPlusHandoverSchedule(propertyPrice, PAYMENT_PLANS.DAMAC.bookingPct, 40, 40, 24)
    case 'DANUBE':
      return buildDanubeSchedule(propertyPrice, PAYMENT_PLANS.DANUBE.bookingPct)
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
