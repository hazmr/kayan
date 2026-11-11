// Server-only. Reads environment variables once and fails loudly when one is missing,
// so a misconfigured server stops at startup instead of failing on the first request.

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

function port(name: string, fallback: number): number {
  const raw = optional(name)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a port number`)
  }
  return parsed
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  payloadSecret: required('PAYLOAD_SECRET'),
  siteUrl: required('NEXT_PUBLIC_SITE_URL').replace(/\/+$/, ''),
  isProduction: process.env.NODE_ENV === 'production',
  smtp: {
    host: required('SMTP_HOST'),
    port: port('SMTP_PORT', 587),
    user: optional('SMTP_USER'),
    pass: optional('SMTP_PASS'),
  },
  emailFrom: {
    address: required('EMAIL_FROM_ADDRESS'),
    name: required('EMAIL_FROM_NAME'),
  },
} as const
