import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { ar } from '@payloadcms/translations/languages/ar'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Courses } from '@/collections/Courses'
import { Lessons } from '@/collections/Lessons'
import { Media } from '@/collections/Media'
import { Modules } from '@/collections/Modules'
import { OwnerPromotions } from '@/collections/OwnerPromotions'
import { Users } from '@/collections/Users'
import { PlatformSettings } from '@/globals/PlatformSettings'
import { DEFAULT_LOCALE, isRtl, LOCALE_LABELS, LOCALES } from '@/i18n/locales'
import { env } from '@/lib/env'
import { attachErrorCode } from '@/lib/errors/attachErrorCode'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Our own errors (wrong state, not allowed, and so on) are expected outcomes, not crashes.
// Log them as one info line instead of an error with a stack trace.
const expectedErrorLevels = { AppError: 'info' } as const

export default buildConfig({
  secret: env.payloadSecret,

  // Payload is the engine only: database, login, access rules, and the API under /api.
  // Its admin screens are not mounted. Our own dashboard lives in src/app/(frontend).
  admin: {
    user: Users.slug,
  },

  collections: [Courses, Modules, Lessons, Categories, Media, Users, OwnerPromotions],
  globals: [PlatformSettings],

  // Resizes uploaded images (course thumbnails).
  sharp,

  db: postgresAdapter({
    pool: {
      connectionString: env.databaseUrl,
    },
    // UUIDs match the string ids in the provider interfaces and cannot be guessed by counting.
    idType: 'uuid',
    // The schema changes only through migration files, in development too.
    // Why: development then behaves exactly like production, including hand-written indexes.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),

  email: nodemailerAdapter({
    defaultFromAddress: env.emailFrom.address,
    defaultFromName: env.emailFrom.name,
    transportOptions: {
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth:
        env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    },
  }),

  // Content languages: localized fields (course titles and so on) store one value per locale.
  localization: {
    locales: LOCALES.map((code) => ({
      code,
      label: LOCALE_LABELS[code],
      rtl: isRtl(code),
    })),
    defaultLocale: DEFAULT_LOCALE,
    fallback: true,
  },

  // Admin panel interface languages. Arabic switches the panel to right-to-left.
  i18n: {
    supportedLanguages: { ar, en },
    fallbackLanguage: 'en',
  },

  // Only our own site may send logged-in requests or call the API from a browser.
  cors: [env.siteUrl],
  csrf: [env.siteUrl],

  // We do not use GraphQL, so its endpoints are switched off: fewer doors to guard.
  graphQL: {
    disable: true,
  },

  hooks: {
    afterError: [attachErrorCode],
  },

  // `Forbidden` is listed with its default level only because Payload's type for this option
  // knows its own error names and rejects an object made of ours alone.
  loggingLevels: { Forbidden: 'info', ...expectedErrorLevels },

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
