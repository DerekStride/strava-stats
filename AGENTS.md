# AGENTS.md

This file provides context for Claude Code when working on this project.

## Project Overview

This is a static site generator that fetches Strava activity data and renders it as minimal HTML calendars. It runs monthly via GitHub Actions and deploys to GitHub Pages.

## Key Files

- `scripts/fetch_strava.rb` - Fetches all activities from Strava API, outputs `data/stats.json`
- `scripts/render_html.rb` - Reads JSON, generates HTML pages in `docs/`
- `docs/style.css` - Minimal CSS with dark/light mode support
- `.github/workflows/monthly-strava.yml` - Scheduled workflow (1st of month)

## Data Flow

1. `fetch_strava.rb` authenticates via OAuth refresh token
2. Fetches all activities (paginated), transforms to simple JSON format
3. `render_html.rb` groups activities by year/month/day
4. Generates `index.html` (current year) + `YYYY.html` (past years)
5. GitHub Pages serves from `/docs`

## Activity Types

The owner's main activities are:
- **Weight Training** - Primary, tracked by session count + duration
- **Run** - Primary, tracked by sessions + distance + elevation
- **Ride** - Secondary, tracked by sessions + distance + elevation

Other types (Hike, Walk, Swim, Yoga, etc.) appear on calendars but not in stats summaries.

## Icon Mapping

Activity icons use Lucide (CDN). Mapping is in `ACTIVITY_ICONS` constant in `render_html.rb`.

## Units

All units are metric:
- Distance: kilometers (km)
- Elevation: meters (m)
- Time: hours

## Styling Notes

- Max width: 720px
- Font: System font stack
- Colors: CSS variables with `prefers-color-scheme` for dark mode
- Accent color: Strava orange (#fc4c02)
- Calendar grid: 3 columns × 4 rows for months

## Common Tasks

### Regenerate site locally
```bash
bundle exec ruby scripts/fetch_strava.rb && ruby scripts/render_html.rb
```

### Add new activity type icon
Edit `ACTIVITY_ICONS` in `scripts/render_html.rb`, use icon name from https://lucide.dev

### Change which types show in stats
Edit `DISTANCE_TYPES` and `DURATION_TYPES` constants in `scripts/render_html.rb`
