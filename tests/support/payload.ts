import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { vi } from 'vitest'

export interface SentEmail {
  to: string
  subject: string
  html: string
}

/** Every email the app tried to send during a test, instead of sending it. */
export const emails = {
  sent: [] as SentEmail[],
  reset(): void {
    this.sent = []
  },
  to(address: string): SentEmail[] {
    return this.sent.filter((email) => email.to === address)
  },
  /** Emails whose subject contains the text (subjects hold Arabic and English side by side). */
  withSubject(text: string): SentEmail[] {
    return this.sent.filter((email) => email.subject.includes(text))
  },
}

/**
 * Starts the real app (Payload, with the test database from vitest's env) and stops it from
 * sending real emails. Call once per test file, in beforeAll.
 */
export async function startApp(): Promise<Payload> {
  const payload = await getPayload({ config })
  vi.spyOn(payload, 'sendEmail').mockImplementation(async (message) => {
    emails.sent.push({
      to: String(message.to),
      subject: String(message.subject ?? ''),
      html: String(message.html ?? ''),
    })
    return undefined as never
  })
  return payload
}

export async function stopApp(payload: Payload): Promise<void> {
  vi.restoreAllMocks()
  await payload.destroy()
}
