import { addDataAndFileToRequest, type Endpoint, type PayloadRequest } from 'payload'

import { AppError } from '@/lib/errors/AppError'
import { cancelOrder } from '@/lib/orders/cancelOrder'
import { changeMethod } from '@/lib/orders/changeMethod'
import {
  cancelRefundRequest,
  declineRefund,
  refundOrder,
  requestRefund,
} from '@/lib/orders/refunds'
import { approveReceipt, rejectReceipt } from '@/lib/orders/reviewReceipt'
import { startOrder } from '@/lib/orders/startOrder'
import { submitReceipt } from '@/lib/orders/submitReceipt'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/orders/transitions'
import type { Order } from '@/payload-types'

// Every endpoint here is thin on purpose: read the input, call ONE function from src/lib/orders,
// answer with the order's id and status. The rules live in that function, not here.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The order id from the URL. A malformed id is "not found", never a database error. */
function orderIdFrom(req: PayloadRequest): string {
  const id = req.routeParams?.id
  if (typeof id !== 'string' || !UUID.test(id)) throw new AppError('NOT_FOUND')
  return id
}

async function jsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  const body: unknown = await req.json?.().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
}

function methodFrom(value: unknown): PaymentMethod | undefined {
  return PAYMENT_METHODS.find((method) => method === value)
}

function answer(order: Order, extra: Record<string, unknown> = {}): Response {
  return Response.json({ id: order.id, reference: order.reference, status: order.status, ...extra })
}

function post(path: string, handler: (req: PayloadRequest) => Promise<Response>): Endpoint {
  return { path, method: 'post', handler }
}

export const orderEndpoints: Endpoint[] = [
  // --- the student ---
  post('/start', async (req) => {
    const body = await jsonBody(req)
    const courseId = text(body, 'courseId')
    if (!UUID.test(courseId)) throw new AppError('NOT_FOUND')
    const { order, resumed } = await startOrder({ courseId, method: methodFrom(body.method), req })
    return answer(order, { resumed })
  }),

  post('/:id/method', async (req) => {
    const method = methodFrom((await jsonBody(req)).method)
    if (!method) throw new AppError('PAYMENT_METHOD_UNAVAILABLE')
    return answer(await changeMethod(orderIdFrom(req), method, req))
  }),

  // multipart: the screenshot in `file`, and { senderNumber, expectedAmount } in `_payload`
  post('/:id/receipt', async (req) => {
    const orderId = orderIdFrom(req)
    await addDataAndFileToRequest(req)
    const data: Record<string, unknown> = req.data ?? {}
    const file = req.file
    if (!file) throw new AppError('VALIDATION_FAILED')
    const expectedAmount = typeof data.expectedAmount === 'number' ? data.expectedAmount : NaN
    if (!Number.isInteger(expectedAmount)) throw new AppError('VALIDATION_FAILED')

    const order = await submitReceipt({
      orderId,
      file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.size },
      senderNumber: text(data, 'senderNumber'),
      expectedAmount,
      req,
    })
    return answer(order)
  }),

  post('/:id/cancel', async (req) => answer(await cancelOrder(orderIdFrom(req), req))),

  post('/:id/refund-request', async (req) => {
    const body = await jsonBody(req)
    const order = await requestRefund(
      orderIdFrom(req),
      { reason: text(body, 'reason'), refundTo: text(body, 'refundTo') },
      req,
    )
    return answer(order, { refundStatus: order.refundStatus })
  }),

  post('/:id/refund-request/cancel', async (req) => {
    const order = await cancelRefundRequest(orderIdFrom(req), req)
    return answer(order, { refundStatus: order.refundStatus })
  }),

  // --- managers and the owner ---
  post('/:id/approve', async (req) => answer(await approveReceipt(orderIdFrom(req), req))),

  post('/:id/reject', async (req) =>
    answer(await rejectReceipt(orderIdFrom(req), text(await jsonBody(req), 'note'), req)),
  ),

  post('/:id/refund-request/decline', async (req) => {
    const order = await declineRefund(orderIdFrom(req), text(await jsonBody(req), 'note'), req)
    return answer(order, { refundStatus: order.refundStatus })
  }),

  post('/:id/refund', async (req) => answer(await refundOrder(orderIdFrom(req), req))),
]
