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
  // The name people see (header, page titles, emails), per language. The project itself is
  // called kayan; each academy that runs it sets its own name here.
  siteName: {
    ar: optional('SITE_NAME_AR') ?? optional('SITE_NAME_EN') ?? 'Kayan',
    en: optional('SITE_NAME_EN') ?? optional('SITE_NAME_AR') ?? 'Kayan',
  },
  // The doctor the academy is built around, named on the home page. Defaults to the site name.
  instructorName: {
    ar: optional('INSTRUCTOR_NAME_AR') ?? optional('SITE_NAME_AR') ?? 'Kayan',
    en: optional('INSTRUCTOR_NAME_EN') ?? optional('SITE_NAME_EN') ?? 'Kayan',
  },
  // A short line under the doctor's name on the home page, for example "Veterinarian".
  instructorTitle: {
    ar: optional('INSTRUCTOR_TITLE_AR') ?? optional('INSTRUCTOR_TITLE_EN'),
    en: optional('INSTRUCTOR_TITLE_EN') ?? optional('INSTRUCTOR_TITLE_AR'),
  },
  // The doctor's photo for the home page, a path inside /public (for example /academy/hassan-helal-portrait.webp).
  // Without it, the home page shows a generic illustration.
  instructorPhoto: optional('INSTRUCTOR_PHOTO'),
  // Where uploaded files are kept on disk (development and tests). Default: the project folder.
  // Production moves to object storage (Cloudflare R2), where this is not used.
  uploadsDir: optional('UPLOADS_DIR') ?? '.',
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
