# Future Work: HTML Rendering for GitHub Pages

This document outlines the next phase of the project: rendering Strava stats as minimal HTML for GitHub Pages.

## Goal

Transform `data/stats.json` into a clean, text-based HTML page that can be served via GitHub Pages.

## Files to Create

### 1. `templates/index.html.erb`

ERB template that reads `data/stats.json` and renders:

```
STRAVA STATS
Updated January 2026

─────────────────────────

RUNNING
  42 activities
  312.4 miles
  28h 45m
  15,230 ft elevation

CYCLING
  18 activities
  485.2 miles
  24h 12m
  22,100 ft elevation

─────────────────────────

TOTALS
  68 activities
  842.6 miles
  58h 22m
```

### 2. `docs/style.css`

Minimal CSS:
- System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`)
- Monospace for numbers
- Dark/light mode via `prefers-color-scheme`
- Fixed-width container (~600px max)
- Subtle borders using box-drawing characters

### 3. `scripts/render_html.rb`

Script that:
1. Reads `data/stats.json`
2. Renders `templates/index.html.erb`
3. Writes to `docs/index.html`

## Workflow Updates

Update `.github/workflows/monthly-strava.yml` to:
1. Run `fetch_strava.rb` (existing)
2. Run `render_html.rb` (new)
3. Commit both `data/` and `docs/`

## GitHub Pages Setup

1. Go to repository Settings > Pages
2. Source: Deploy from branch
3. Branch: `main`, folder: `/docs`
4. Site will be live at `https://<username>.github.io/<repo-name>/`

## Implementation Notes

- Keep the HTML simple and semantic (`<pre>` or `<div>` with monospace)
- Format moving time as `Xh Ym` (e.g., "28h 45m")
- Format elevation with commas (e.g., "15,230 ft")
- Include a "last updated" timestamp
- Consider adding a link back to your main site
