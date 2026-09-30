# ICM Deal Platform

Internal deal tracking for Stream Realty Partners' Industrial Capital Markets team.
Scope and decisions: [docs/PRD.md](docs/PRD.md). Working rules: [CLAUDE.md](CLAUDE.md).

## Stack

Next.js (App Router) on Vercel · Neon Postgres via Drizzle ORM · Auth.js magic-link sign-in sent through Resend.

## Local setup

1. Install Node.js LTS (nodejs.org).
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in every value (each one is explained in that file).
4. `npm run db:migrate` to create the tables, then `npm run db:seed` to create the three admins, the Stream Realty Partners and Private Investors companies, and a Stream contact for each user.
5. `npm run dev` and open http://localhost:3000

## Environment variables

Documented in [.env.example](.env.example). In production they are set in Vercel → Project → Settings → Environment Variables.

| Name | What it is |
|---|---|
| `AUTH_SECRET` | Random secret signing sign-in tokens and cookies |
| `RESEND_API_KEY` | Resend key used to send sign-in emails |
| `EMAIL_FROM` | Sender address for sign-in emails |
| `DATABASE_URL` | Neon Postgres connection string |
| `GOOGLE_MAPS_API_KEY` | Google Geocoding key for address Look up (optional until set up) |

## Database changes

Edit `src/db/schema.ts`, run `npm run db:generate` to write a migration into `drizzle/`, commit it, then `npm run db:migrate`.

## Authentication

All auth code lives in `src/auth/`; the rest of the app imports only from `@/auth`. To swap magic links for Entra ID later, change that folder only. Rules (15-minute single-use links, fixed 7-day sessions, `@streamrealty.com` only, immediate deactivation) are described in CLAUDE.md.

## Accounts

GitHub, Vercel, Neon and Resend accounts are owned by haili.rumsey@streamrealty.com. Before the team gets access: move to Vercel Pro, a paid Neon tier with point-in-time restore, transfer this repo to a Stream-owned GitHub organization, and verify a Resend sending domain.
