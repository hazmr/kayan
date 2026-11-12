import { randomUUID } from 'crypto'
import { FileUploadError, ValidationError, type PayloadRequest } from 'payload'

import { requireUser } from '@/lib/auth/requireActor'
import { withTransaction } from '@/lib/db/withTransaction'
import { sendReceiptSubmittedEmail } from '@/lib/email/orderEmails'
import { AppError } from '@/lib/errors/AppError'
import type { Order } from '@/payload-types'

import { assertOwnsOrder, emailContextFor, freezeAmounts, loadCourse, lockOrder } from './shared'
import { assertTransition } from './transitions'

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export interface UploadedImage {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

interface SubmitReceiptArgs {
  orderId: string
  file: UploadedImage
  senderNumber: string
  /** The amount the student saw on screen. Only checked while the price can still change. */
  expectedAmount: number
  req: PayloadRequest
}

/**
 * The student says "I paid" by uploading a screenshot and the number they sent from.
 *   pending  -> awaiting_review   the amount locks in here (price, doctor's share, doctor)
 *   rejected -> awaiting_review   the amount was already locked; this is just a new receipt
 */
export async function submitReceipt({
  orderId,
  file,
  senderNumber,
  expectedAmount,
  req,
}: SubmitReceiptArgs): Promise<Order> {
  const user = requireUser(req)

  const extension = EXTENSIONS[file.mimetype]
  if (!extension) throw new AppError('RECEIPT_INVALID_TYPE')
  if (file.size > RECEIPT_MAX_BYTES) throw new AppError('RECEIPT_TOO_LARGE')
  const sender = senderNumber.trim()
  if (sender === '' || sender.length > 40) throw new AppError('VALIDATION_FAILED')

  const order = await withTransaction(req, async () => {
    const current = await lockOrder(orderId, req)
    assertOwnsOrder(current, user)
    assertTransition(current.status, 'awaiting_review')
    if (!current.method) throw new AppError('PAYMENT_METHOD_UNAVAILABLE')

    let frozen: Awaited<ReturnType<typeof freezeAmounts>> | undefined
    if (current.status === 'pending') {
      const course = await loadCourse(
        typeof current.course === 'string' ? current.course : current.course.id,
        req,
      )
      if (course.status !== 'published') throw new AppError('COURSE_NOT_PURCHASABLE')
      // The price moved after the student's page loaded. Nothing is saved: they see the new
      // amount and decide again. (Free courses never reach here: they have no receipt.)
      if (course.price === 0 || course.price !== expectedAmount) {
        throw new AppError('ORDER_PRICE_CHANGED')
      }
      frozen = await freezeAmounts(course, req, new Date())
    }

    try {
      await req.payload.create({
        collection: 'receipts',
        data: { order: current.id, senderNumber: sender },
        // A random name, so the file name never reveals who sent it or what it is.
        file: { ...file, name: `${randomUUID()}.${extension}` },
        overrideAccess: true,
        req,
      })
    } catch (error) {
      // Payload checks the real file contents, not just the type the browser claimed.
      if (error instanceof FileUploadError || error instanceof ValidationError) {
        throw new AppError('RECEIPT_INVALID_TYPE')
      }
      throw error
    }

    return req.payload.update({
      collection: 'orders',
      id: current.id,
      data: { status: 'awaiting_review', ...frozen },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  await sendReceiptSubmittedEmail(await emailContextFor(order, req))
  return order
}
