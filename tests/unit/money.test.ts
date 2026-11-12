import { describe, expect, it } from 'vitest'

import { egpToPiasters, ownerShare, piastersToEgp } from '@/lib/money'

describe('money', () => {
  it('converts pounds to piasters and back without rounding errors', () => {
    expect(egpToPiasters(400)).toBe(40000)
    expect(egpToPiasters(50.25)).toBe(5025)
    expect(egpToPiasters(0.29)).toBe(29) // 0.29 * 100 is 28.999999999999996 in floating point
    expect(piastersToEgp(40000)).toBe(400)
    expect(piastersToEgp(5025)).toBe(50.25)
  })

  describe("the doctor's share of a sale", () => {
    it('is amount x percent / 100', () => {
      expect(ownerShare(40000, 70)).toBe(28000)
      expect(ownerShare(55000, 70)).toBe(38500)
      expect(ownerShare(40000, 100)).toBe(40000)
      expect(ownerShare(40000, 0)).toBe(0)
    })

    it('rounds DOWN, so the doctor is never overpaid', () => {
      expect(ownerShare(101, 70)).toBe(70) // 70.7
      expect(ownerShare(1, 99)).toBe(0) // 0.99
      expect(ownerShare(99, 33)).toBe(32) // 32.67
    })

    it('never gives the doctor more than the sale, nor a fraction of a piaster', () => {
      for (const amount of [1, 7, 99, 100, 12345, 40000]) {
        for (const percent of [0, 1, 33, 50, 70, 99, 100]) {
          const share = ownerShare(amount, percent)
          expect(Number.isInteger(share)).toBe(true)
          expect(share).toBeLessThanOrEqual(amount)
          expect(share).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('gives 0 for a free course', () => {
      expect(ownerShare(0, 70)).toBe(0)
    })
  })
})
