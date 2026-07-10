import { describe, expect, it } from 'vitest'
import {
  HANDOVER_MONTH,
  amountDueInMonth,
  buildMilestoneSchedule,
  cumulativePaidByMonth,
} from './paymentPlans.js'

const PRICE = 1000000

describe('buildMilestoneSchedule', () => {
  it('Emaar sums to exactly 100% of price by handover, with nothing owed past it', () => {
    const schedule = buildMilestoneSchedule('EMAAR', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 1)).toBe(0)
  })

  it('Damac is only 60% paid at handover — its 40% back-end spreads over the 24 months after', () => {
    const schedule = buildMilestoneSchedule('DAMAC', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE * 0.6, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 1)).toBeGreaterThan(0) // post-handover installment begins
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH + 24)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 25)).toBe(0)
  })

  it('Danube sums to exactly 100% of price by month 90 (10% booking + 90 months of 1%), not by handover', () => {
    const schedule = buildMilestoneSchedule('DANUBE', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE * 0.46, 6) // 10% + 36%
    expect(cumulativePaidByMonth(schedule, 90)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, 91)).toBe(0)
  })

  it('Emaar charges a 20% lump on top of the regular installment at handover', () => {
    const schedule = buildMilestoneSchedule('EMAAR', PRICE)
    const regularInstallment = amountDueInMonth(schedule, 1)
    const handoverAmount = amountDueInMonth(schedule, HANDOVER_MONTH)
    expect(handoverAmount).toBeCloseTo(regularInstallment + PRICE * 0.2, 6)
  })

  it("Damac's month-36 installment is just the regular spread amount — no lump, since the 40% moved post-handover", () => {
    const schedule = buildMilestoneSchedule('DAMAC', PRICE)
    const regularInstallment = amountDueInMonth(schedule, 1)
    const handoverAmount = amountDueInMonth(schedule, HANDOVER_MONTH)
    expect(handoverAmount).toBeCloseTo(regularInstallment, 6)
  })

  it('throws on an unknown plan key', () => {
    expect(() => buildMilestoneSchedule('UNKNOWN', PRICE)).toThrow()
  })
})
