# ICM Deal Platform

Internal deal tracking system for Stream Realty Partners' Industrial Capital Markets team. Replaces a hand-maintained pipeline spreadsheet and is the single source of truth for deals, properties, bids, companies and contacts.

Users: 12 people across Dallas and Houston. Primary stakeholder is Haili Rumsey (operations), who is not a developer — explain tradeoffs in plain terms and surface decisions rather than making them silently.

The PRD is the source of truth for scope. Every field in it was deliberately chosen, including the ones left out. **If something seems missing, it was probably cut on purpose — ask before adding it.**

## Stack

| Layer | Choice |
|---|---|
| App | Next.js on Vercel |
| Database | Neon Postgres |
| Auth | Email magic links — Auth.js email provider, sent via Resend (**not** Entra ID) |
| Scheduled jobs | Vercel Cron |
| Outbound email | Resend |
| Geocoding | Google Geocoding API |
| Source control | Private GitHub repo, Stream-owned account |

Serverless — nothing runs continuously. Scheduled work must go through Vercel Cron.

**Code location:** `~/Code/icm-deal-platform` — never inside OneDrive (sync corrupts git and chokes on `node_modules`). This OneDrive folder holds the PRD and reference files only.

**Hosting tiers:** free tiers (Vercel Hobby, Neon free, Resend test mode, GitHub personal account on Haili's Stream email) while Haili builds and tests alone. Before anyone else gets access or real client data is loaded: Vercel Pro, Neon paid tier with PITR, repo transferred to a Stream-owned GitHub org, Resend sending domain verified (domain choice still open).

## Authentication

Entra ID SSO was dropped (PRD Rev. 4.1) to avoid a dependency on Stream IT.

- Sign-in: user enters email → one-time link → clicks it. Only `@streamrealty.com`, and only active users an admin has added.
- Links are single-use and expire after 15 minutes. Sessions last a fixed 7 days (no rolling extension), then sign in again.
- Sessions are stored in the database so deactivation can end them immediately.
- The emailed link opens a confirm page with a "Sign in" button. Microsoft Safe Links pre-opens links in email and would otherwise consume the single-use token.
- **Isolated layer:** all auth code lives in `src/auth/`. The rest of the app uses only its exported helpers (`getCurrentUser`, `requireUser`, `requireAdmin`, `signIn`, `signOut`), so Entra ID can be swapped in later by changing that folder alone.
- **Admins** (user administration, delete, closed-deal unlock): haili.rumsey@streamrealty.com, skoschak@streamrealty.com, mhamilton@streamrealty.com. Seeded in the database, not editable in the UI.
- User admin screen: add a user, list everyone with access, deactivate (immediately blocks new links **and** kills active sessions), reactivate.
- Stream people who aren't app users (referrers, former brokers) are stored as **Contacts**, not users. How an app user links to their own contact record is to be confirmed at the start of 1.2.

## Non-negotiable principles

1. **Never block a user.** Required fields are prompted, not enforced. Deals can be created at any stage and moved between stages with incomplete data. Exit conditions describe transitions; they do not gate them.
   - The only hard requirements: a note when a bid is marked fell out; company website and contact email — both with explicit "none" overrides.
2. **Closed deals lock.** Read-only except for three named users, who can unlock, edit and relock. Covers the whole record, not just financials.
3. **One deal, many properties.** About half are multi-property. Never model a single property per deal.
4. **Three independent financial blocks** — BOV, OM/Guidance, Closed. Each holds its own price and underwriting. They never overwrite each other. BOV overwrites in place on repricing.
5. **Bids attach to companies, not contacts.** The record survives a contact changing firms.
6. **No permissions layer.** All users see all deals and all fields. Do not build role-based visibility.
7. **Party labels vary by deal type.** Same underlying structure, different labels:
   - Sale → seller / buyer
   - Equity → sponsor / capital partner
   - Debt → borrower / lender
   - Lease → landlord / tenant

## Domain notes

- **Stages:** BOV 1 → BOV 2 → Engaged → Marketing → Awarded (DD + PSA) → Under Contract → Closed. Plus Track (dormant, excluded from active pipeline totals) and Dead/Lost.
- **"Awarded" always means a buyer was selected**, never that Stream won the listing. Winning the listing is `won_date`.
- **Geography is three levels:** state → city → submarket, submarket filtered by city. Controlled list, closed to user additions.
- **Duplicate prevention:** properties match on Google `place_id` plus building designation; companies on website domain; contacts on email. All warn rather than block.
- **Companies are recorded under the institutional owner's real name**, never the LP or LLC holding the asset. There is no parent/subsidiary hierarchy — the rollup happens at data entry.
- **The IOS desk does both sales and leases.** All of it — sales and leases alike — is entered as closed only, never tracked as active pipeline, and carries `is_ios` so revenue reports can separate that desk from core ICM. `is_ios` marks the desk; `category` marks the asset type. A core ICM deal can involve an IOS property without being an IOS-desk deal.
- **`place_id` is a matching attribute, never a primary key** — Google reissues them.

## Working agreement

- Build milestone by milestone in PRD order, starting at 1.1.
- **Stop at the end of each milestone** for testing against its "done when" criteria. Do not work ahead.
- Ask questions before writing code rather than assuming.
- Flag anything that would expand scope beyond the PRD.

## Data sensitivity

Holds client contacts, deal financials, bid terms and fee data. Do not log sensitive values, do not commit secrets, and keep environment variables documented so the project survives a change of maintainer.

## Next.js version note

@AGENTS.md
