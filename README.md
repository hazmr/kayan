# kayan

An online course platform for one academy (the first one: a veterinary academy in Egypt). Next.js 16 with Payload CMS 3 as the engine (database, login, access rules, API), PostgreSQL, Tailwind CSS, shadcn/ui.

The plan and design live in [docs/](docs/): requirements first, then design.

## The name

The project is called **kayan** everywhere in the code, the repository, the database and the
scripts. What visitors see is the academy's own name, set in `.env`:

```bash
SITE_NAME_AR=هلال أكاديمي
SITE_NAME_EN=Helal Academy
INSTRUCTOR_NAME_AR=د. حسن هلال
INSTRUCTOR_NAME_EN=Dr. Hassan Helal
EMAIL_FROM_NAME=Helal Academy
```

The academy name appears in the header, the dashboard, page titles, and emails; the doctor's
name appears on the home page ("Learn veterinary medicine with Dr. Hassan Helal"). Another academy using kayan only
changes these lines.

## Run it locally

You need Node.js 24 or newer, pnpm, and Docker.

```bash
cp .env.example .env        # then set PAYLOAD_SECRET (the file explains how)
pnpm install
pnpm services:up            # Postgres on port 5433, Mailpit (email inbox) on port 8025
pnpm migrate                # create the database tables
SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD='a-long-password' SUPERADMIN_NAME='Your name' pnpm superadmin:create   # the one Admin, id zero
pnpm dev
```

| Address                         | What                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| http://localhost:3000           | The site. Redirects to `/ar`. English is at `/en`.           |
| http://localhost:3000/dashboard | The dashboard for the Admin and instructors                  |
| http://localhost:8025           | Mailpit: every email the app sends in development lands here |

Open the site as `localhost`, not `127.0.0.1`. Logged-in requests are only accepted from the address in `NEXT_PUBLIC_SITE_URL`.

## A full academy to try things

On an EMPTY development database, `pnpm seed` creates everything at once:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_NAME='Your name' pnpm seed
```

- the Admin (id zero), and the instructor Dr. Hassan Helal (`SEED_INSTRUCTOR_EMAIL`, default `hassan.helal@kayan.test`)
- 4 categories and 13 published courses from Dr. Hassan Helal's teaching playlists (real YouTube lessons, with thumbnails; prices and 10-minute durations are placeholders)
- 5 test students (`student1@kayan.test` to `student5@kayan.test`), each in a different situation: paid with progress, receipt waiting, not paid yet, refund requested, free course finished and an earlier refund
- test payment details, to replace in Settings

Passwords that are not given (`SEED_ADMIN_PASSWORD`, `SEED_TEST_PASSWORD`) are generated and printed once.

To start over: drop and recreate the database, delete the `media` and `receipts` folders, run `pnpm migrate`, then `pnpm seed`.

## A big demo course to try things

`pnpm demo:seed` adds one free demo course with 6 modules and 36 lessons to your development database (owned by the first doctor account, or `DEMO_DOCTOR_EMAIL`). Log in as a student, enroll with one click, and try the player and the progress tracker. It does nothing if the course already exists.

## Roles

One academy, three roles:

| Role                         | Who                                          | Can do                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** (key `superadmin`) | Exactly one person                           | Everything, including users and settings. Nobody can demote, edit, or delete this account from the app. Created once with `pnpm superadmin:create`, which refuses if an Admin exists. |
| **Instructor** (key `admin`) | The doctor and whoever helps run the academy | Courses (create, edit, publish, archive), receipts, refunds, orders, categories                                                                                                       |
| **Student**                  | Learners                                     | Buy and watch                                                                                                                                                                         |

## Money

Students pay the academy's own InstaPay or Vodafone Cash (set in Settings). The Admin earns a
percentage of each paid sale (Settings, Admin only; it starts at 0%). Each order freezes the
Admin's share when the student pays, so a new percentage only affects new sales. The academy
records each payment it makes to the Admin; the Overview and the "Admin's share" page show what
is still owed. Every change to the payment details is emailed to the Admin and all instructors.

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

| Group       | What it covers                                                                                                                                                                                                                                                             | Where               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Unit        | The balance rules, money and rounding, both status diagrams, the payment and video adapters, the "who may watch" rule, slugs, safe redirects, and that every error code has Arabic and English text                                                                        | `tests/unit`        |
| Integration | The real code against a real database: `fulfillOrder` and `refundOrder` (idempotent, safe under simultaneous calls, all-or-nothing), the order flow, earnings and payouts, the lesson-video rules, the last-owner rule, and **one test for every row of the access table** | `tests/integration` |
| Browser     | One purchase from start to finish in a real browser (guest, login, payment, receipt, an instructor approving, the student watching, the doctor earning), then what each role sees and that only students buy                                                               | `tests/e2e`         |

The tests never touch your development data. They create their own databases, `kayan_test` and
`kayan_e2e`, from scratch on every run using the real migration files, and their own upload folders.

You need `psql` installed (the setup uses it to create the test database). To point the tests at
another Postgres server, set `TEST_DATABASE_URL_BASE`, for example
`postgresql://user:password@localhost:5432`.

For the browser test, either install Playwright's browser once with
`pnpm exec playwright install chromium`, or use a browser you already have:
`E2E_BROWSER_PATH=/usr/bin/brave pnpm test:e2e`. It runs the app on port 3100, so it can run while the
development server is on port 3000. Its emails go to the same Mailpit inbox as development.
