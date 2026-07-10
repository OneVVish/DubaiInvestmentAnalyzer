import { describe, expect, it } from 'vitest'
import { buildCsv } from './csvExport.js'

const sampleData = [
  { year: 1, buyerNetWorth: 1000000, renterNetWorth: 900000, homeValue: 1000000 },
  { year: 2, buyerNetWorth: 1100000, renterNetWorth: 950000, homeValue: 1100000 },
]

describe('buildCsv', () => {
  it('emits a header row with human-readable column labels', () => {
    const [header] = buildCsv(sampleData).split('\n')
    expect(header).toBe('Year,Buyer Net Worth (AED),Renter Net Worth (AED),Home Value (AED)')
  })

  it('emits one data row per year, in order', () => {
    const lines = buildCsv(sampleData).split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('1,1000000,900000,1000000')
    expect(lines[2]).toBe('2,1100000,950000,1100000')
  })
})
