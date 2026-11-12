import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { getPaymentProvider } from '@/lib/payments'
import { manualProvider } from '@/lib/payments/manual'
import { availableMethods, payToFor } from '@/lib/payments/settings'
import type { Order } from '@/payload-types'

// A stand-in for Payload that only knows how to hand back the payment settings.
function payloadWith(settings: {
  instapayAddress?: string | null
  vodafoneCashNumber?: string | null
}) {
  return { findGlobal: async () => settings } as unknown as Payload
}
const order = (method: string | null): Order =>
  ({ id: 'o1', method, amount: 40000, reference: 'VT-ABC234' }) as unknown as Order

describe('manual payment adapter (InstaPay and Vodafone Cash by hand)', () => {
  const payload = payloadWith({
    instapayAddress: ' shop@instapay ',
    vodafoneCashNumber: '01000000099',
  })

  it('answers with instructions: where to pay, how much, and the reference', async () => {
    expect(await manualProvider.startPayment(order('instapay'), { payload })).toEqual({
      kind: 'instructions',
      payTo: 'shop@instapay', // trimmed
      amount: 40000,
      reference: 'VT-ABC234',
    })
    expect(await manualProvider.startPayment(order('vodafone_cash'), { payload })).toMatchObject({
      payTo: '01000000099',
    })
  })

  it('refuses an order with no payment method', async () => {
    await expect(manualProvider.startPayment(order(null), { payload })).rejects.toMatchObject({
      code: 'PAYMENT_METHOD_UNAVAILABLE',
    })
  })

  it('refuses a method the owner has not filled in', async () => {
    const half = payloadWith({ instapayAddress: 'shop@instapay', vodafoneCashNumber: '   ' })
    await expect(
      manualProvider.startPayment(order('vodafone_cash'), { payload: half }),
    ).rejects.toMatchObject({
      code: 'PAYMENT_METHOD_UNAVAILABLE',
    })
    await expect(
      manualProvider.startPayment(order('instapay'), { payload: half }),
    ).resolves.toBeTruthy()
  })

  it('refuses an unknown method', async () => {
    await expect(manualProvider.startPayment(order('bitcoin'), { payload })).rejects.toMatchObject({
      code: 'PAYMENT_METHOD_UNAVAILABLE',
    })
  })

  it('has no webhook: there is no API to call back', () => {
    expect(manualProvider.handleWebhook).toBeUndefined()
    expect(manualProvider.id).toBe('manual')
  })
})

describe('payment settings helpers', () => {
  it('offers only the methods that are filled in', () => {
    expect(availableMethods({ instapayAddress: '', vodafoneCashNumber: '' })).toEqual([])
    expect(availableMethods({ instapayAddress: 'a', vodafoneCashNumber: '' })).toEqual(['instapay'])
    expect(availableMethods({ instapayAddress: 'a', vodafoneCashNumber: 'b' })).toEqual([
      'instapay',
      'vodafone_cash',
    ])
  })

  it('picks the right field for each method', () => {
    const settings = { instapayAddress: 'a@b', vodafoneCashNumber: '010' }
    expect(payToFor('instapay', settings)).toBe('a@b')
    expect(payToFor('vodafone_cash', settings)).toBe('010')
  })
})

describe('payment provider registry', () => {
  it('returns the manual adapter', () => {
    expect(getPaymentProvider('manual')).toBe(manualProvider)
  })

  it('has no Paymob adapter yet (adding it is one new file and one line)', () => {
    expect(() => getPaymentProvider('paymob')).toThrow(
      expect.objectContaining({ code: 'PAYMENT_METHOD_UNAVAILABLE' }),
    )
  })
})
