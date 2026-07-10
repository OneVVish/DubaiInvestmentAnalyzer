// Handover — when the buyer takes possession — happens at month 36 for all
// three plans. Danube's 1%/month installments continue 44 months past that,
// through month 80; Emaar and Damac are fully paid off at handover.
export const HANDOVER_MONTH = 36

export const PAYMENT_PLANS = {
  EMAAR: { key: 'EMAAR', label: 'Emaar Premium (80/20)' },
  DAMAC: { key: 'DAMAC', label: 'Damac (60/40)' },
  DANUBE: { key: 'DANUBE', label: 'Danube "1% Monthly"' },
}

// Emaar and Damac share the same shape (20% down, a percentage spread evenly
// over the 36-month construction period, and a lump sum due at handover on
// top of that month's regular installment) — only the split differs.
function buildSpreadPlusHandoverSchedule(propertyPrice, spreadPct, handoverLumpPct) {
  const schedule = [{ month: 0, amount: propertyPrice * 0.2 }]
  const monthlyAmount = (propertyPrice * spreadPct) / 100 / HANDOVER_MONTH
  for (let month = 1; month <= HANDOVER_MONTH; month++) {
    const amount =
      month === HANDOVER_MONTH ? monthlyAmount + propertyPrice * (handoverLumpPct / 100) : monthlyAmount
    schedule.push({ month, amount })
  }
  return schedule
}

function buildDanubeSchedule(propertyPrice) {
  const schedule = [{ month: 0, amount: propertyPrice * 0.2 }]
  for (let month = 1; month <= 80; month++) {
    schedule.push({ month, amount: propertyPrice * 0.01 })
  }
  return schedule
}

export function buildMilestoneSchedule(planKey, propertyPrice) {
  switch (planKey) {
    case 'EMAAR':
      return buildSpreadPlusHandoverSchedule(propertyPrice, 60, 20)
    case 'DAMAC':
      return buildSpreadPlusHandoverSchedule(propertyPrice, 40, 40)
    case 'DANUBE':
      return buildDanubeSchedule(propertyPrice)
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
