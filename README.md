# Strava Stats

A minimal, calendar-based visualization of Strava activity data, automatically updated monthly via GitHub Actions and served via GitHub Pages.

## Features

- **Calendar view**: See your activities at a glance with icons for each workout type
- **Year-by-year pages**: Current year on index, past years on separate pages
- **Activity breakdown**: Stats grouped by type (Weight Training, Run, Ride)
- **Dark/light mode**: Automatically adapts to system preference
- **Monthly updates**: GitHub Actions fetches fresh data on the 1st of each month

## Setup

### 1. Create Strava API Application

1. Go to https://www.strava.com/settings/api
2. Create an application with callback domain `localhost`
3. Note your Client ID and Client Secret

### 2. Get Refresh Token

```bash
# Open in browser (replace YOUR_CLIENT_ID)
https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&scope=activity:read&approval_prompt=force

# After authorizing, exchange code for tokens
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=AUTHORIZATION_CODE \
  -d grant_type=authorization_code
```

### 3. Configure GitHub Secrets

Add these secrets to your repository (Settings → Secrets → Actions):

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

### 4. Enable GitHub Pages

1. Go to Settings → Pages
2. Source: Deploy from branch
3. Branch: `main`, folder: `/docs`

## Local Development

```bash
# Install dependencies
bundle install

# Fetch Strava data (requires env vars)
export STRAVA_CLIENT_ID=xxx
export STRAVA_CLIENT_SECRET=xxx
export STRAVA_REFRESH_TOKEN=xxx
bundle exec ruby scripts/fetch_strava.rb

# Generate HTML
ruby scripts/render_html.rb

# Preview
open docs/index.html
```

## Project Structure

```
├── scripts/
│   ├── fetch_strava.rb    # Fetches activities from Strava API
│   └── render_html.rb     # Generates HTML from JSON data
├── data/
│   └── stats.json         # Activity data (generated)
├── docs/
│   ├── index.html         # Current year (generated)
│   ├── YYYY.html          # Past year pages (generated)
│   └── style.css          # Styles
└── .github/
    └── workflows/
        └── monthly-strava.yml
```

## Activity Icons

Uses [Lucide](https://lucide.dev) icons:

| Activity | Icon |
|----------|------|
| Run | footprints |
| Ride | bike |
| Weight Training | dumbbell |
| Swim | waves |
| Yoga | flower |
| Hike | mountain |

## Preview

<img width="378" height="627" alt="Screenshot 2026-01-16 at 10 48 28" src="https://github.com/user-attachments/assets/a6fc073c-bce5-45b4-966f-ecadd81a9482" />

