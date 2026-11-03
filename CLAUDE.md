# ICM Deal Platform — code

**The project instructions live in the OneDrive project folder, not here:**
`~/Library/CloudStorage/OneDrive-StreamRealtyPartners-SRP-ICM/5. Pipeline/Dashboard/CLAUDE.md`

Read that file (and `PRD.md` and the `Project notes/` folder beside it) before doing anything. It holds the project rules, every decision so far, the open items, and how Haili likes to work. This file used to be a copy of it; it went out of date, so it's now just this pointer (2026-11-03).

Code-specific reminders (details in the main CLAUDE.md):
- This Next.js version differs from older ones — see `AGENTS.md` and the guides in `node_modules/next/dist/docs/` before writing code.
- Secrets are in `.env.local` (documented in `.env.example`). Never copy or print them.
- Database changes: `npm run db:generate`, then `npm run db:migrate`. Adding a column is safe before a push; removing one only after the code that stopped using it is live.
- Haili commits and pushes; the live site (Vercel) updates from GitHub `main`.
