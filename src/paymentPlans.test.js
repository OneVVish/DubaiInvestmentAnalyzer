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

  it('Damac is fully paid off at handover — its 40% lands as a lump at month 36, like Emaar', () => {
    const schedule = buildMilestoneSchedule('DAMAC', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 1)).toBe(0)
  })

  it('Balanced 50/50 is only 50% paid at handover — its 50% back-end spreads over the 36 months after', () => {
    const schedule = buildMilestoneSchedule('BALANCED_5050', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE * 0.5, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 1)).toBeGreaterThan(0) // post-handover installment begins
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH + 36)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 37)).toBe(0)
  })

  it('Aggressive 40/60 is only 40% paid at handover — its 60% back-end spreads over the 60 months after', () => {
    const schedule = buildMilestoneSchedule('AGGRESSIVE_4060', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE * 0.4, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 1)).toBeGreaterThan(0) // post-handover installment begins
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH + 60)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, HANDOVER_MONTH + 61)).toBe(0)
  })

  it('Danube sums to exactly 100% of price by month 80 (20% booking + 80 months of 1%), not by handover', () => {
    const schedule = buildMilestoneSchedule('DANUBE', PRICE)
    expect(cumulativePaidByMonth(schedule, HANDOVER_MONTH)).toBeCloseTo(PRICE * 0.56, 6) // 20% + 36%
    expect(cumulativePaidByMonth(schedule, 80)).toBeCloseTo(PRICE, 6)
    expect(amountDueInMonth(schedule, 81)).toBe(0)
  })

  it('Danube Classic sums to exactly 100% of price by month 90 (10% booking + 90 months of 1%), not by handover', () => {
    const schedule = buildMilestoneSchedule('DANUBE_CLASSIC', PRICE)
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
