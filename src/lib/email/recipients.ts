import type { PayloadRequest } from 'payload'

/** Everyone who runs the academy: the Admin and every instructor. */
export async function staffEmails(req: PayloadRequest): Promise<string[]> {
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { role: { in: ['superadmin', 'admin'] } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    req,
  })
  return docs.map((user) => user.email)
}

/** Sends one email to each address. A failed email is logged and never undoes the work. */
export async function sendToEach(
  req: PayloadRequest,
  to: string[],
  subject: string,
  html: string,
  what: string,
): Promise<void> {
  await Promise.all(
    to.map((address) =>
      req.payload.sendEmail({ to: address, subject, html }).catch((error: unknown) => {
        req.payload.logger.error({ err: error, msg: `${what} email failed` })
      }),
    ),
  )
}
