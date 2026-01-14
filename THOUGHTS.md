Derek Stride: New project idea. I want to take the Strava data from my Strava account and convert it into something that could be rendered on my personal website in a minimal format. It almost looks like text-based but is a little bit nicer using proper HTML. It would be nice if we can do this with GitHub Action Workflows. I need to look up if there's a way to schedule them to run every month. And we could probably make use of some Strava API SDKs.

---

Raycast AI: Great project idea! Here's what you need to know:

## GitHub Actions Scheduling

---

Tool: web_search

---

Raycast AI: 

GitHub Actions supports scheduled workflows using the `schedule` event with CRON syntax. To run monthly, you'd use a cron expression like `0 0 1 * *` (runs at midnight on the 1st of every month). Here's the basic structure:

```yaml
name: Monthly Strava Update
on:
  schedule:
    - cron: '0 0 1 * *'  # First day of every month at midnight UTC
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      # Your workflow steps here
```

The cron format is: `minute hour day month day-of-week`. You can test expressions at [crontab.guru](https://crontab.guru). [Source](https://jackharner.com/blog/github-actions-cron/)

## Strava API SDKs

For Python, **stravalib** is the primary SDK for interacting with the Strava API. It handles authentication, token refresh, and provides easy methods to fetch activities and athlete data. The library includes automatic token refresh functionality since Strava tokens expire after 6 hours. [Source](https://stravalib.readthedocs.io/en/v2.2/get-started/how-to-get-strava-data-python.html)

For JavaScript/Node.js, you can use the raw Strava API with libraries like `axios` or `node-fetch`, though there isn't an official Node.js SDK as mature as stravalib.

## Practical Architecture

A working example uses this flow: fetch your Strava data with the API SDK in the workflow, transform it into HTML/JSON, commit the changes back to your repo, and let your site build pipeline redeploy. You'd store your Strava credentials (client ID, client secret, refresh token) as GitHub secrets. [Source](https://www.curtiscode.dev/post/project/displaying-strava-stats-using-webhooks/)

This approach is clean for a

---

Raycast AI:  personal site—the GitHub Actions free tier gives you plenty of monthly minutes for monthly updates, and you get version control history of your activity data as a bonus.

---

Derek Stride: Here’s a ruby one I would use: https://github.com/dblock/strava-ruby-client

---

Raycast AI: Perfect! The `strava-ruby-client` by dblock is an excellent choice for Ruby. It's well-maintained and provides a clean interface to the Strava API.

---

Tool: read_page

---

Raycast AI: Perfect! **strava-ruby-client** is an excellent choice. Here's what makes it ideal for your project:

## Key Features

* **Complete OAuth Support** - Handles the full OAuth refresh token flow, which is critical since Strava access tokens expire after 6 hours. You can securely store a refresh token in GitHub Secrets and let the client handle token renewal automatically.

* **Rich Data Models** - Provides first-class Ruby objects for activities, athletes, and all Strava entities with built-in conversion helpers for distance, time, and elevation.

* **Thorough Pagination** - Natively supports pagination, so you can fetch all activities across multiple pages with minimal code.

* **Consistent Error Handling** - Better error handling compared to other Ruby clients, and built-in rate limit tracking.

## Your Workflow Architecture

Here's a suggested approach for your project:

```ruby
# Gemfile
gem 'strava-ruby-client'
gem 'erb'  # For HTML templating
```

```ruby
# lib/strava_exporter.rb
require 'strava-ruby-client'

class StravaExporter
  def initialize(access_token)
    Strava.configuration.access_token = access_token
    @client = Strava::Api::Client.new
  end

  def fetch_recent_activities(months_back: 1)
    @client.athlete_activities(per_page: 100) do |activity|
      activity.start_date >= months_back.months.ago
    end
  end

  def render_to_html(activities)
    # Transform activities into minimal HTML
    # Iterate over activities and build clean HTML
  end
end
```

```yaml
# .github/workflows/monthly-strava-update.yml
name: Monthly Strava Update
on:
  schedule:
    - cron: '0 0 1 * *'  # First day of every month at midnight UTC
  workflow_dispatch:     # Also allow manual trigger
jobs:
  update

---

Raycast AI: :
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
      - name: Fetch Strava data
        run: |
          ruby scripts/update_strava.rb
        env:
          STRAVA_ACCESS_TOKEN: ${{ secrets.STRAVA_ACCESS_TOKEN }}
          STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
          STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
      - name: Commit changes
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add -A
          git commit -m "Update Strava data" || echo "No changes to commit"
          git push
```

## Next Steps

1. Set up your OAuth token using `strava-ruby-client`'s built-in tools and store the refresh token in GitHub Secrets
2. Build a simple Ruby script that uses the client to fetch your activities
3. Create an ERB template for minimal HTML output
4. The workflow will auto-run monthly and commit the generated files to your repo

The refresh token approach is clean because it survives between workflow runs, and the gem handles token refresh automatically.

---

Derek Stride: My website is deployed on Github pages: https://docs.github.com/api/article/body?pathname=/en/pages

and it supports project pages, so I can enable that on a custom repo. I think that's a good integration point for the actino

---

Raycast AI: <thinking>
The user is saying that their website is deployed on GitHub Pages and they're linking to the GitHub Pages documentation. They mention that GitHub Pages supports project pages, which means they can use a separate repository to host the Strava data visualization and enable GitHub Pages on that repo.

This is actually a great approach for their project. They could:

1. Create a dedicated repository (e.g., `strava-stats` or similar)
2. Enable GitHub Pages on that repository (pointing to the `docs` folder or `gh-pages` branch)
3. Have the GitHub Actions workflow generate the minimal HTML/content
4. Commit it to the repository 
5. GitHub Pages will automatically serve it

This is cleaner than trying to integrate it into their main site repository, and gives them a separate project site specifically for their Strava stats.

Let me provide a clear explanation of how this would work as an integration point.
</thinking>

Excellent thinking! Using a separate GitHub Pages project repository is a perfect integration point. Here's how it would work:

## Setup

1. **Create a dedicated repo** (e.g., `strava-stats` or `running-stats`)
2. **Enable GitHub Pages** on that repo pointing to the `docs/` folder or `gh-pages` branch
3. Your site becomes accessible at `https://yourusername.github.io/strava-stats/`

## Workflow Integration

```yaml
# .github/workflows/monthly-strava-update.yml
name: Monthly Strava Update
on:
  schedule:
    - cron: '0 0 1 * *'
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
      
      - name: Fetch and generate Strava stats
        run: ruby scripts/generate_strava_stats.rb
        env:
          STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
          STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
      
      - name: Commit and push
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add docs/
          git commit -m "Update Strava stats" || echo "No changes"
          git push
        # GitHub Pages automatically rebuilds when files change
```

The beauty is that **GitHub Pages automatically redeploys whenever you push** to the repo, so once the workflow generates your minimal HTML into `docs/index.html` (or similar), GitHub Pages picks it up instantly with no additional steps needed.

You could also embed this as an iframe or link to it from your main site if you want to keep them separate.
