import { describe, expect, it } from 'vitest'
import {
  HANDOVER_MONTH,
  amountDueInMonth,
  buildMilestoneSchedule,
  cumulativePaidByMonth,
} from './paymentPlans.js'

const PRICE = 1000000

describe('buildMilestoneSchedule', () => {
  it.each(['EMAAR', 'DAMAC'])('%s sums to exactly 100% of price by handover', (plan) => {
    const schedule = buildMilestoneSchedule(plan, PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE, 6)
    // Nothing owed past handover for these two plans.
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 1)).toBe(0)
  })

  it('Danube sums to exactly 100% of price by month 80, not by handover', () => {
    const schedule = buildMilestoneSchedule('DANUBE', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE * 0.56, 6)
    expect(cumulativePaidByMonth(schedule, 80)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, 81)).toBe(0)
  })

  it('Emaar charges a 20% lump on top of the regular installment at handover', () => {
    const schedule = buildMilestoneSchedule('EMAAR', PRICE)
    const regularInstallment = amountDueInMonth(schedule, 1)
    const handoverAmount = amountDueInMonth(schedule, HANDOVER_MONTH)
    expect(handoverAmount).toBeCloseTo(regularInstallment + PRICE * 0.2, 6)
  })

  it('Damac charges a 40% lump on top of the regular installment at handover', () => {
    const schedule = buildMilestoneSchedule('DAMAC', PRICE)
    const regularInstallment = amountDueInMonth(schedule, 1)
    const handoverAmount = amountDueInMonth(schedule, HANDOVER_MONTH)
    expect(handoverAmount).toBeCloseTo(regularInstallment + PRICE * 0.4, 6)
  })

  it('throws on an unknown plan key', () => {
    expect(() => buildMilestoneSchedule('UNKNOWN', PRICE)).toThrow()
  })
})
