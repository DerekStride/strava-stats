# Strava Stats SaaS — Technical Plan

## Overview

Turn the existing single-user static site generator into a multi-user hosted service on Cloudflare Pages. Users connect their Strava account via OAuth, the app fetches their activities, renders minimal calendar pages, and serves them at a permanent URL.

**Current state:** Ruby scripts run monthly via GitHub Actions, fetch one user's data, generate static HTML, deploy to GitHub Pages.

**Target state:** TypeScript app on Cloudflare Pages with D1 database. Any Strava user can connect and get their own calendar page at `/u/:strava_id`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Cloudflare Pages                       │
│                                                          │
│   public/              functions/             D1         │
│   ┌───────────┐        ┌──────────────┐    ┌──────────┐ │
│   │ index.html│        │ /auth/strava │    │  users   │ │
│   │ style.css │        │ /auth/callback│   │  rendered │ │
│   └───────────┘        │ /api/refresh │    │  _pages  │ │
│                        │ /api/disconnect│   └──────────┘ │
│                        │ /u/[id]      │                  │
│                        └──────────────┘                  │
└──────────────────────────────────────────────────────────┘
                              │
                              │ OAuth + API calls
                              ▼
                    ┌───────────────────┐
                    │   Strava API      │
                    │   (per-user auth) │
                    └───────────────────┘
```

### Stack

| Component | Technology | Cost |
|---|---|---|
| Hosting + Functions | Cloudflare Pages (Workers) | Free tier: 100K requests/day |
| Database | Cloudflare D1 (SQLite) | Free tier: 5M reads/day, 100K writes/day |
| Secrets | Cloudflare Pages secrets | Free |
| Domain | Optional custom domain | ~$10/year |
| Auth | Strava OAuth (no password system) | Free |
| Token encryption | Web Crypto API (AES-256-GCM) | Built into Workers runtime |
| Sessions | Signed cookies (HMAC-SHA256) | No storage needed |

**Total infrastructure cost at launch: $0**

---

## OAuth Flow — How Multi-User Auth Works

### Key concept: App credentials vs user credentials

| Credential | Belongs to | How many | Where stored |
|---|---|---|---|
| Client ID | You (developer) | 1 | Cloudflare secret |
| Client Secret | You (developer) | 1 | Cloudflare secret |
| Access Token | Each user | 1 per user | D1, encrypted |
| Refresh Token | Each user | 1 per user | D1, encrypted |

You register **one** Strava API application at [strava.com/settings/api](https://www.strava.com/settings/api). That gives you a client ID and secret. Every user who connects authorizes **your app** to read **their** data. Strava returns per-user tokens that your app stores.

### The flow step by step

```
1. User clicks "Connect with Strava"
   → GET /auth/strava
   → 302 redirect to https://www.strava.com/oauth/authorize?
       client_id=YOUR_APP_ID&
       redirect_uri=https://yourapp.pages.dev/auth/callback&
       response_type=code&
       scope=read,activity:read_all&
       approval_prompt=auto

2. User sees Strava's authorization page, clicks "Authorize"
   → Strava redirects to GET /auth/callback?code=abc123

3. Callback handler exchanges the code for tokens:
   → POST https://www.strava.com/oauth/token
     { client_id, client_secret, code, grant_type: "authorization_code" }
   ← { access_token, refresh_token, expires_at, athlete: { id, firstname } }

4. Encrypt tokens with AES-256-GCM, store in D1 users table
5. Set signed session cookie (HMAC-SHA256)
6. Redirect to /u/:strava_id

7. User clicks "Generate My Calendar"
   → POST /api/refresh
   → Fetches all activities using their access token
   → Renders HTML calendar pages
   → Stores rendered HTML in D1 rendered_pages table

8. Subsequent visits to /u/:strava_id serve pre-rendered HTML from D1
```

### Token refresh — access tokens expire every 6 hours

Before making API calls, the app checks `token_expires_at`. If expired (or expiring within 60 seconds), it exchanges the refresh token for a new access token:

```
POST https://www.strava.com/oauth/token
{ client_id, client_secret, refresh_token, grant_type: "refresh_token" }
← { access_token (new), refresh_token (possibly rotated), expires_at }
```

**Critical:** Strava may rotate the refresh token on each use. The app always saves the new refresh token. If you don't, the old one stops working and the user must re-authorize.

### Deauthorization — user disconnects

When a user clicks "Disconnect":
1. App tells Strava to revoke access: `POST /oauth/deauthorize`
2. App deletes all user data from D1 (CASCADE deletes rendered pages too)
3. Clears the session cookie

This is **required** by the Strava API Agreement — you must delete all user data when they revoke access.

---

## Strava API Terms — What's Allowed and What's Not

Based on the [Strava API Agreement](https://www.strava.com/legal/api) (updated October 2025).

### Restrictions that directly affect this product

#### 1. 7-day data cache limit

> "No Strava Data shall remain in your cache longer than seven days."

**Impact:** You cannot permanently store raw activity JSON. The scaffold handles this by storing only **rendered HTML** (your product's output, not raw Strava data) and discarding the API response after rendering. This is the strongest argument for compliance, but it's untested legally.

**Mitigation:** The `/api/refresh` endpoint fetches activities, renders HTML, stores the HTML, and never persists the raw activity data. The `rendered_pages` table contains your HTML output, not Strava's data format.

#### 2. No competing with Strava

> "You may not use the Strava API Materials in any manner that is competitive to Strava."

**Risk:** A calendar view of activities resembles Strava's Training Log. The stats summaries could be considered "analytics."

**Mitigation:** The calendar is a year-at-a-glance overview (GitHub contribution graph style), not a detailed training log. It doesn't show pace, heart rate, splits, maps, or social features. The more visually distinct it is from Strava, the safer.

#### 3. No AI/ML usage

> "You may not use the Strava API Materials for any model training related to artificial intelligence, machine learning or similar applications."

**Impact:** Don't feed activity data into AI models. Don't add "AI insights" features.

#### 4. Rate limits

| Limit | Value |
|---|---|
| Read requests per 15 min | 100 |
| Read requests per day | 1,000 |
| Total requests per 15 min | 200 |
| Total requests per day | 2,000 |

A single user with 500 activities needs ~5 paginated requests. With 100 users all refreshing in the same day, that's ~500 requests — within limits but tight. Rate limits reset at :00/:15/:30/:45 (15-min) and midnight UTC (daily).

**Mitigation:** Only fetch on user-initiated refresh, not on a schedule. Show "last updated" timestamp so users don't refresh unnecessarily.

#### 5. Single Player Mode (the launch blocker)

New Strava apps are locked to **1 athlete**. To support multiple users, you must apply through the [Developer Program](https://developers.strava.com):

- Submit screenshots of your app
- Show Strava Brand Guidelines compliance
- Describe your use case
- Demonstrate demand (approaching 100+ users)

**This is a chicken-and-egg problem.** You can't get users without approval, and you can't demonstrate demand without users. Build the app with your own account first, get the UI polished, then apply with screenshots.

#### 6. Attribution requirements

Every page must include:
- **"Powered by Strava" logo** — the scaffold includes this in rendered pages and the landing page
- **"View on Strava" links** — TODO: link each activity day back to the original activity on Strava (requires storing activity IDs, which we currently discard)

The "Connect with Strava" button on the landing page must use [Strava's official button assets](https://developers.strava.com/guidelines/).

#### 7. Monetization rules

- **Cannot** charge for access to Strava data
- **Can** charge for your own features (hosting, rendering, themes, exports)
- **Cannot** use Strava data in advertising
- **Can** include non-targeted ads in your app

A pricing model of "free to generate, paid for persistent hosting" charges for your infrastructure, not Strava data. This is the line apps like VeloViewer walk.

#### 8. Data deletion on deauth

When a user disconnects or Strava revokes your app's access:
- Delete all personal data from your systems
- This is absolute — no "keep for analytics" exceptions
- Must comply with GDPR Article 32 standards
- Must notify Strava of data breaches within 24 hours

The scaffold handles this: `DELETE FROM users WHERE id = ?` with `ON DELETE CASCADE` removes everything.

---

## Environment Setup

### 1. Strava API Application

Go to [strava.com/settings/api](https://www.strava.com/settings/api) and create an application:

| Field | Value |
|---|---|
| Application Name | Your app name (cannot include "Strava") |
| Category | Training / Visualization |
| Website | Your domain or pages.dev URL |
| Authorization Callback Domain | `your-app.pages.dev` (no path, no https://) |

After creation, note your **Client ID** and **Client Secret**.

### 2. Cloudflare Setup

#### Create the project

```bash
cd app
npm install

# Authenticate with Cloudflare
npx wrangler login

# Create the D1 database
npx wrangler d1 create strava-stats
# Output will include a database_id — copy it
```

#### Update wrangler.toml

Replace `placeholder-replace-after-d1-create` with the actual `database_id` from the command above.

#### Run the database migration

```bash
# Remote (production)
npm run db:migrate

# Local (development)
npm run db:migrate:local
```

### 3. Secrets — Where Each One Goes

#### Cloudflare Pages Secrets (production)

Set via CLI:

```bash
npx wrangler pages secret put STRAVA_CLIENT_ID
npx wrangler pages secret put STRAVA_CLIENT_SECRET
npx wrangler pages secret put SESSION_SECRET
npx wrangler pages secret put ENCRYPTION_KEY
```

Or set in the Cloudflare dashboard: **Pages → your project → Settings → Environment variables**.

| Secret | Value | How to generate |
|---|---|---|
| `STRAVA_CLIENT_ID` | From Strava API settings | Strava gives you this |
| `STRAVA_CLIENT_SECRET` | From Strava API settings | Strava gives you this |
| `SESSION_SECRET` | Random 64-char hex string | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Random 64-char hex string | `openssl rand -hex 32` |

#### Local Development

Create a `.dev.vars` file in `app/` (this is Cloudflare's local env file, already gitignored by wrangler):

```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key
```

#### GitHub Secrets (for the existing static site)

These stay as-is for the original GitHub Actions workflow. They are **not** used by the Cloudflare app:

| Secret | Used by |
|---|---|
| `STRAVA_CLIENT_ID` | `scripts/fetch_strava.rb` (GitHub Actions) |
| `STRAVA_CLIENT_SECRET` | `scripts/fetch_strava.rb` (GitHub Actions) |
| `STRAVA_REFRESH_TOKEN` | `scripts/fetch_strava.rb` (GitHub Actions) |

The GitHub secrets and Cloudflare secrets can use the **same** Strava client ID and secret (same app), or you can create a second Strava app to keep them separate. Using the same app is fine — they share the app-level rate limits either way.

### 4. Deploy

```bash
cd app

# Local development
npx wrangler pages dev public

# Production deploy
npm run deploy
```

After deploying, update your Strava app's **Authorization Callback Domain** to match your pages.dev subdomain (e.g., `strava-stats.pages.dev`).

---

## Database Schema

```sql
-- Users: one row per connected Strava athlete
CREATE TABLE users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_id         INTEGER UNIQUE NOT NULL,      -- Strava athlete ID
  firstname         TEXT NOT NULL DEFAULT '',
  access_token      TEXT NOT NULL,                 -- AES-256-GCM encrypted
  refresh_token     TEXT NOT NULL,                 -- AES-256-GCM encrypted
  token_expires_at  INTEGER NOT NULL,              -- Unix timestamp
  last_fetched_at   INTEGER,                       -- When activities were last pulled
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Rendered pages: pre-rendered HTML per user per year
CREATE TABLE rendered_pages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  html        TEXT NOT NULL,                       -- Full HTML page
  rendered_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, year)
);
```

**What's stored vs what's not:**

| Data | Stored? | Reason |
|---|---|---|
| Strava OAuth tokens | Yes (encrypted) | Needed to refresh and fetch |
| Raw activity JSON | **No** | 7-day cache rule; fetched, rendered, discarded |
| Rendered HTML pages | Yes | Your product output, not raw Strava data |
| User profile (name) | Minimal | Just firstname for display |

---

## File Structure

```
app/
├── public/                          # Static assets (served by Cloudflare Pages)
│   ├── index.html                   # Landing page with "Connect with Strava"
│   └── style.css                    # Full CSS (landing + calendar + dark mode)
├── functions/                       # Cloudflare Pages Functions (serverless)
│   ├── auth/
│   │   ├── strava.ts                # GET /auth/strava → redirect to Strava OAuth
│   │   └── callback.ts             # GET /auth/callback → exchange code, create user
│   ├── api/
│   │   ├── refresh.ts               # POST /api/refresh → fetch + render + store
│   │   └── disconnect.ts           # POST /api/disconnect → revoke + delete
│   └── u/
│       └── [id].ts                  # GET /u/:strava_id → serve calendar page
├── src/                             # Shared modules (imported by functions)
│   ├── types.ts                     # TypeScript interfaces
│   ├── crypto.ts                    # AES-256-GCM encrypt/decrypt
│   ├── session.ts                   # Signed cookie session management
│   ├── strava.ts                    # Strava API client (OAuth + activities)
│   └── render.ts                    # Calendar HTML renderer (ported from Ruby)
├── schema.sql                       # D1 database migration
├── wrangler.toml                    # Cloudflare configuration + D1 binding
├── package.json                     # Dependencies + scripts
└── tsconfig.json                    # TypeScript configuration
```

---

## Request Flow Diagram

```
Landing Page (public/index.html)
  │
  │ Click "Connect with Strava"
  ▼
GET /auth/strava
  │
  │ 302 → strava.com/oauth/authorize
  ▼
User approves on Strava
  │
  │ 302 → /auth/callback?code=abc123
  ▼
GET /auth/callback
  │ Exchange code for tokens (POST strava.com/oauth/token)
  │ Encrypt tokens (AES-256-GCM)
  │ Upsert user in D1
  │ Set session cookie (HMAC-SHA256)
  │ 302 → /u/:strava_id
  ▼
GET /u/:strava_id
  │ Look up rendered_pages in D1
  │ If none exist → show "Generate My Calendar" button
  │ If exists → serve pre-rendered HTML
  ▼
POST /api/refresh (user clicks button)
  │ Refresh access token if expired
  │ Fetch all activities (paginated, GET /api/v3/athlete/activities)
  │ Render HTML calendar pages (per year)
  │ Store rendered HTML in D1
  │ Discard raw activity data
  │ Return { ok: true }
  ▼
Page reloads → GET /u/:strava_id now serves the rendered calendar
```

---

## Risks and Open Questions

### Risks

1. **Strava can revoke API access at any time.** Your entire product disappears. There is no appeal process documented. This is the existential risk.

2. **The "rendered HTML isn't Strava Data" argument is untested.** Strava's terms say you can't cache Strava Data beyond 7 days. The rendered HTML contains activity dates, types, and aggregated stats — derived from Strava Data. Whether this counts as caching is a gray area.

3. **Developer Program approval is not guaranteed.** If Strava sees this as competing with their Training Log, they may reject the application.

4. **Rate limits constrain growth.** At 1,000 read requests/day, you can serve ~200 users refreshing daily. Requesting higher limits requires demonstrating demand and full compliance.

### Open Questions

- **Should activity IDs be stored to generate "View on Strava" links?** The API terms require linking back to original data. This means storing activity IDs (not full data) alongside the rendered HTML, or embedding them in the HTML at render time.

- **Should there be a scheduled refresh?** Currently refresh is user-initiated. A Cloudflare Cron Trigger could refresh all users weekly, but this burns rate limit budget. With 50 users × 5 requests each = 250 requests, which is 25% of the daily read budget.

- **Pricing model?** Free tier (generate once, no persistence) vs paid (persistent page, auto-refresh). Need to determine the conversion threshold and price point. $3-5/year keeps it impulse-buy territory.

- **Custom domain per user?** e.g., `username.stravastats.com` — technically possible with Cloudflare for SaaS, but adds complexity.

---

## Launch Sequence

1. **Build and polish** — Deploy to pages.dev, connect your own Strava account, verify everything works end to end
2. **Add Strava attribution** — "Powered by Strava" logo, "View on Strava" links, use official connect button assets
3. **Apply for Developer Program** — Submit screenshots, describe the app, request multi-user access
4. **Wait for approval** — This could take days or weeks
5. **Soft launch** — Invite a handful of users, monitor rate limits and error rates
6. **Add billing** — Stripe Checkout for paid tier (persistent pages)
7. **Share** — Post on Strava communities, Reddit r/Strava, Twitter/X
