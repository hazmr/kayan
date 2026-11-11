import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { ar } from '@payloadcms/translations/languages/ar'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from '@/collections/Users'
import { DEFAULT_LOCALE, isRtl, LOCALE_LABELS, LOCALES } from '@/i18n/locales'
import { env } from '@/lib/env'
import { attachErrorCode } from '@/lib/errors/attachErrorCode'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  secret: env.payloadSecret,

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' | Vetudy',
    },
  },

  collections: [Users],

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

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
