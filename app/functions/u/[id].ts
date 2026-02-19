import { getSession } from "../../src/session";
import type { Env, UserRow, RenderedPageRow } from "../../src/types";

// GET /u/:id — serve a user's rendered calendar page
// GET /u/:id?year=2024 — serve a specific year
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const stravaId = parseInt(context.params.id as string);
  if (isNaN(stravaId)) {
    return new Response("Not found", { status: 404 });
  }

  const user = await context.env.DB.prepare(
    "SELECT * FROM users WHERE strava_id = ?"
  )
    .bind(stravaId)
    .first<UserRow>();

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  // Determine which year to show
  const url = new URL(context.request.url);
  const yearParam = url.searchParams.get("year");
  const requestedYear = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  // Check if the current visitor owns this page
  const session = await getSession(context.request, context.env.SESSION_SECRET);
  const isOwner = session?.stravaId === stravaId;

  // Get rendered page
  const page = await context.env.DB.prepare(
    "SELECT * FROM rendered_pages WHERE user_id = ? AND year = ?"
  )
    .bind(user.id, requestedYear)
    .first<RenderedPageRow>();

  if (!page) {
    // No rendered content yet — show a prompt to refresh
    const body = isOwner
      ? noContentOwnerPage(user.firstname, stravaId)
      : noContentVisitorPage();
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(page.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

function noContentOwnerPage(name: string, stravaId: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}'s Strava Stats</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>Welcome, ${name}</h1>
  <p>Your account is connected. Click below to fetch your activities and generate your calendar.</p>
  <button class="btn btn-primary" id="refresh">Generate My Calendar</button>
  <p id="status"></p>
  <script>
    document.getElementById('refresh').addEventListener('click', async () => {
      const btn = document.getElementById('refresh');
      const status = document.getElementById('status');
      btn.disabled = true;
      status.textContent = 'Fetching activities from Strava...';
      try {
        const resp = await fetch('/api/refresh', { method: 'POST' });
        const data = await resp.json();
        if (data.ok) {
          status.textContent = 'Done! Reloading...';
          window.location.reload();
        } else {
          status.textContent = 'Error: ' + (data.error || 'Unknown error');
          btn.disabled = false;
        }
      } catch (e) {
        status.textContent = 'Network error. Try again.';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function noContentVisitorPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Strava Stats</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>Nothing here yet</h1>
  <p>This user hasn't generated their calendar yet.</p>
  <p><a href="/">Create your own &rarr;</a></p>
</body>
</html>`;
}
