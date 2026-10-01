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
| Geocoding | Google Geocoding API + Places API (New), server-side |
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
- **Admins** (user administration, Manage teams, Geography, delete, editing closed deals): haili.rumsey@streamrealty.com, skoschak@streamrealty.com, mhamilton@streamrealty.com. Seeded in the database, not editable in the UI.
- User admin screen: add a user, list everyone with access, deactivate (immediately blocks new links **and** kills active sessions), reactivate.
- Stream people (users, referrers, former brokers) are **Contacts** at the "Stream Realty Partners" company. A user is linked to their contact **by matching email**; adding a user creates the contact if missing.

## Non-negotiable principles

1. **Never block a user.** Required fields are prompted, not enforced. Deals can be created at any stage and moved between stages with incomplete data. Exit conditions describe transitions; they do not gate them.
   - The only hard requirements: a note when a bid is marked fell out; company website and contact email — both with explicit "none" overrides.
   - **Exception (Rev. 4.2): moving into Closed is blocked** until the minimum-to-close fields are filled (list in `src/domain/close-check.ts`). Only on the move into Closed; never applied to the historical import or to admins editing already-closed deals.
2. **Closed deals lock.** Read-only except for the three admins, who can always edit them (no unlock step). Covers the whole record, not just financials. Enforced server-side on every deal action (`assertCanEdit`).
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
- **Geography is three levels:** state → city → submarket. City is the address city, mapped to a market (Grand Prairie → Dallas) whose submarket list it uses. Submarket lives on the **property only**, not the deal. Controlled lists, maintained by admins on the Geography screen; closed to user additions.
- **Duplicate prevention:** properties match on Google `place_id` plus building designation; companies on website domain; contacts on email. All warn rather than block.
- **Companies are recorded under the institutional owner's real name**, never the LP or LLC holding the asset. There is no parent/subsidiary hierarchy — the rollup happens at data entry.
- **The IOS desk does both sales and leases.** All of it — sales and leases alike — is entered as closed only, never tracked as active pipeline, and carries `is_ios` so revenue reports can separate that desk from core ICM. `is_ios` marks the desk; `category` marks the asset type. A core ICM deal can involve an IOS property without being an IOS-desk deal.
- **`place_id` is a matching attribute, never a primary key** — Google reissues them.

## Working agreement

- Build milestone by milestone in PRD order, starting at 1.1.
- **Stop at the end of each milestone** for testing against its "done when" criteria. Do not work ahead.
- Ask questions before writing code rather than assuming.
- Flag anything that would expand scope beyond the PRD.

## Decisions made during the build (PRD Rev. 4.2)

- Contacts have first + last name. Every contact has a company; individuals without one go under the general "Private Investors" company.
- Deal Team: one row per person per deal, multiple roles allowed, lead flags on the row. One lead analyst per deal (setting a new one clears the old).
- Deal team is picked on the deal's Summary from the **ICM team roster** (admin "Manage teams" screen, `contacts.is_icm_team`), not from app users — some members never sign in. Leads are chosen from the deal's team. Members have a location (Dallas/Houston).
- WALT, occupancy as-of date and per-property allocated price were removed from the PRD. All pricing is deal-level (typed in the 1.4 blocks), never summed from properties.
- The IOS flag is labelled "IOS Deal" in the UI.
- Address entry: suggestions as you type (Places API New, Texas-biased), resolved through the Geocoding API; "Look up" stays as a fallback for intersections. All Google calls are server-side; the key is restricted to those two APIs. No match → "Save without Google match", flagged unverified for cleanup.
- Records are archived by anyone, deleted only by the three admins.
- Sale deal value follows the stage (BOV mid → guidance → sale price). There is **one sale price** (`closed_price`) from award through close — no separate contract price; retrades go in price notes. Missing stage price shows as missing, not borrowed. Logic in `src/domain/stages.ts`.

### Stages and money (milestone 1.4)

- **Stage bar** across the deal (full-width chevrons; current stage Stream Blue, completed gray, upcoming light gray; Track and Dead/Lost as buttons at the right) **plus** a Stage field on the Summary. Click any stage — forward, back or skipping.
- Moving into BOV 2 / Engaged / Marketing / Awarded / Closed **asks for that stage's date**, pre-filled with today and skippable — except Closed (close date required). Engaged from BOV 1–2 sets pitch Won; Dead/Lost from BOV 1–2 sets pitch Lost and optionally asks lost-to company + note.
- New deals default to BOV 1 and **can't be created at Closed** (properties/parties come after the first save). IOS deals: save at Under Contract, add property and buyer, then close.
- BOV block hidden for equity/debt/lease; each type shows its headline field. Fields that don't apply are **hidden, not removed**, so switching type never wipes data.
- **Fee section** shows from Engaged on (or whenever fee figures exist). In-house gross = total − outside unless typed over (`in_house_gross_manual`). Fee % plus optional fee notes.
- Sidebar **Pipeline** group: **Active** (BOV 1 → Under Contract), **Closed**, **Archive** (views: Track, Dead/Lost, archived records).
- The deal form is keyed by `last_modified_at`, so it reloads after any server change (stage bar, save) and a later Save can't write stale values back.
- **Unsaved-changes warnings:** stage-bar moves and in-app link clicks use the branded dialog; closing/reloading the tab uses the browser's own box (can't be styled).
- **Branded confirm dialog** (`useConfirm` in `src/components/confirm-dialog.tsx`) replaces the browser's confirm(): larger text, Cancel is the dark default; red confirm only for permanent actions. Used for unsaved changes, deactivate user, delete, and "Can't close yet".
- Money and SF inputs add thousands separators when you leave the box; the server strips `$ , %` on save.

## Status and agreed-for-later

- **Done and tested by Haili:** milestones 1.1–1.4. **Next: 1.5 historical import** — questions not yet asked. Source: `Context/ICM Deal Activity.xlsx` (119 rows). Things to raise: seller/buyer columns hold LP/LLC names (naming standard says institutional owner); deal types include Equity Raise / Debt Placement / Consulting / Referral fees; brokers include non-ICM and "(former employee)" names plus a "Stream ICM Broker" placeholder; a "Deal %" column not in the PRD mapping; dates are Excel serial numbers; 2 rows with no address and 2 with no SF/acres; several repeat addresses (repeat trades); how IOS-desk deals are identified.
- **1.6 Pipeline report** (Haili's spec): group active deals by stage with separators; per stage show # deals, total value, total SF, and total fee (fee only from Engaged on). Track separate, lead analyst the only team field.
- **2.1 Bids:** awarding a bid may offer to fill the sale price from the bid amount — confirm with Haili then.
- **Active-deals spreadsheet:** Haili will provide an updated version; discuss before importing anything (PRD planned manual entry at launch).
- **Testing practice:** non-admin QA account `qa.tester@streamrealty.com` (normally deactivated) gets a short session for browser tests; all test data is prefixed `TEST` and deleted afterward. Never create sessions for real/admin accounts.
- **Removing a column:** commit code that stops using it → Haili pushes → then drop the column, so the live site never breaks.
- Haili prefers instructions **one step at a time**.

## Look and feel

Microsoft Dynamics layout, Stream brand (2023 Brand Guidelines, in `Context/`):
- Navy top bar with the white Stream logo; light-gray grouped sidebar with icons; command bar (New / Save / Refresh / Archive / Delete) on every page; lists with a view switcher, Quick find and sortable columns; record pages with a header of key facts and tabs.
- Colors: Stream Navy #002F6C leads, light gray and white next, Stream Blue #004EA8 as accent (links). Secondary colors only as accents — Sunset Orange marks records flagged for cleanup. Never blue on navy. Body text black. A non-brand red is reserved for permanent Delete.
- Type: Nunito Sans (body), Merriweather (titles). Light mode only.
- Only show commands that work — no placeholder buttons for later milestones.

## Data sensitivity

Holds client contacts, deal financials, bid terms and fee data. Do not log sensitive values, do not commit secrets, and keep environment variables documented so the project survives a change of maintainer.

## Next.js version note

@AGENTS.md
