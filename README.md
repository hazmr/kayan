# Vetudy

Online course marketplace for veterinarians in Egypt. Next.js 16 with Payload CMS 3 as the engine (database, login, access rules, API), PostgreSQL, Tailwind CSS, shadcn/ui.

The plan and design live in [docs/](docs/): requirements first, then design.

## Run it locally

You need Node.js 24 or newer, pnpm, and Docker.

```bash
cp .env.example .env        # then set PAYLOAD_SECRET (the file explains how)
pnpm install
pnpm services:up            # Postgres on port 5433, Mailpit (email inbox) on port 8025
pnpm migrate                # create the database tables
SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD='a-long-password' pnpm superadmin:create
pnpm dev
```

| Address                         | What                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| http://localhost:3000           | The site. Redirects to `/ar`. English is at `/en`.           |
| http://localhost:3000/dashboard | Our dashboard for the owner, managers, and doctors           |
| http://localhost:8025           | Mailpit: every email the app sends in development lands here |

Open the site as `localhost`, not `127.0.0.1`. Logged-in requests are only accepted from the address in `NEXT_PUBLIC_SITE_URL`.

## A big demo course to try things

`pnpm demo:seed` adds one free demo course with 6 modules and 36 lessons to your development database (owned by the first doctor account, or `DEMO_DOCTOR_EMAIL`). Log in as a student, enroll with one click, and try the player and the progress tracker. It does nothing if the course already exists.

## The master owner

One owner account can be made the **master owner**: nobody can demote, edit, or delete it from the app, not even other owners. Pick it once, on the server:

```bash
MASTER_OWNER_EMAIL=you@example.com pnpm master:set
```

The account must already be an owner. To move the title to someone else, run it again with `MASTER_OWNER_REPLACE=yes`. There is no page or API for this on purpose.

## Everyday commands

| Command                      | What it does                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                   | Start the development server                                  |
| `pnpm typecheck`             | Check TypeScript types                                        |
| `pnpm lint`                  | Run ESLint                                                    |
| `pnpm format`                | Format the code with Prettier                                 |
| `pnpm build`                 | Production build                                              |
| `pnpm generate:types`        | Regenerate `src/payload-types.ts` after changing a collection |
| `pnpm migrate:create <name>` | Create a migration after changing a collection                |
| `pnpm migrate`               | Apply migrations that have not run yet                        |

## Changing the database

The schema changes only through migrations, in development too, so development behaves like production.

1. Edit a collection in `src/collections`.
2. `pnpm generate:types`
3. `pnpm migrate:create short-name`
4. `pnpm migrate`
5. Commit the new files in `src/migrations`.

## Testing

```bash
pnpm services:up      # Postgres must be running (the tests need it)
pnpm test             # unit + integration tests (about 40 seconds)
pnpm test:unit        # only the unit tests (about 1 second, no database)
pnpm test:int         # only the integration tests
pnpm test:e2e         # the browser test of a whole purchase (builds the app first)
```

| Group       | What it covers                                                                                                                                                                                                                                                              | Where               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Unit        | The balance rules, money and rounding, both status diagrams, the payment and video adapters, the "who may watch" rule, slugs, safe redirects, and that every error code has Arabic and English text                                                                         | `tests/unit`        |
| Integration | The real code against a real database: `fulfillOrder` and `refundOrder` (idempotent, safe under simultaneous calls, all-or-nothing), the order flow, earnings and payouts, the lesson-video rules, the last-owner rule, and **one test for every row of the access table**  | `tests/integration` |
| Browser     | One purchase from start to finish in a real browser (guest, login, payment, receipt, manager approval, the student watching, the doctor earning), then what each role sees: owner revenue, manager without money, doctor's own numbers, no Buy button for doctors and staff | `tests/e2e`         |

The tests never touch your development data. They create their own databases, `vetudy_test` and
`vetudy_e2e`, from scratch on every run using the real migration files, and their own upload folders.

You need `psql` installed (the setup uses it to create the test database). To point the tests at
another Postgres server, set `TEST_DATABASE_URL_BASE`, for example
`postgresql://user:password@localhost:5432`.

For the browser test, either install Playwright's browser once with
`pnpm exec playwright install chromium`, or use a browser you already have:
`E2E_BROWSER_PATH=/usr/bin/brave pnpm test:e2e`. It runs the app on port 3100, so it can run while the
development server is on port 3000. Its emails go to the same Mailpit inbox as development.
