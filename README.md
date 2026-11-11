# Vetudy

Online course marketplace for veterinarians in Egypt. Next.js 16 and Payload CMS 3 in one app, PostgreSQL, Tailwind CSS, shadcn/ui.

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

| Address | What |
|---------|------|
| http://localhost:3000 | The site. Redirects to `/ar`. English is at `/en`. |
| http://localhost:3000/admin | Admin panel for superadmin, managers, and doctors |
| http://localhost:8025 | Mailpit: every email the app sends in development lands here |

Open the site as `localhost`, not `127.0.0.1`. Logged-in requests are only accepted from the address in `NEXT_PUBLIC_SITE_URL`.

## Everyday commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start the development server |
| `pnpm typecheck` | Check TypeScript types |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format the code with Prettier |
| `pnpm build` | Production build |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` after changing a collection |
| `pnpm migrate:create <name>` | Create a migration after changing a collection |
| `pnpm migrate` | Apply migrations that have not run yet |

## Changing the database

The schema changes only through migrations, in development too, so development behaves like production.

1. Edit a collection in `src/collections`.
2. `pnpm generate:types`
3. `pnpm migrate:create short-name`
4. `pnpm migrate`
5. Commit the new files in `src/migrations`.
