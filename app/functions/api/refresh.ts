import { refreshTokens, fetchAllActivities } from "../../src/strava";
import { renderUserPages } from "../../src/render";
import { getSession } from "../../src/session";
import type { Env, UserRow } from "../../src/types";

// POST /api/refresh — fetch latest activities from Strava and re-render pages
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await getSession(context.request, context.env.SESSION_SECRET);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await context.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(session.userId)
    .first<UserRow>();

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  try {
    // Refresh access token if needed
    const { accessToken } = await refreshTokens(user, context.env);

    // Fetch all activities from Strava
    const activities = await fetchAllActivities(accessToken);

    // Render HTML pages for each year
    const pages = renderUserPages(activities, user.firstname);

    // Store rendered pages (upsert per year)
    for (const [year, html] of Object.entries(pages)) {
      await context.env.DB.prepare(
        `INSERT INTO rendered_pages (user_id, year, html, rendered_at)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT (user_id, year) DO UPDATE SET
           html = excluded.html,
           rendered_at = unixepoch()`
      )
        .bind(user.id, parseInt(year), html)
        .run();
    }

    // Update last_fetched_at
    await context.env.DB.prepare(
      "UPDATE users SET last_fetched_at = unixepoch(), updated_at = unixepoch() WHERE id = ?"
    )
      .bind(user.id)
      .run();

    return Response.json({ ok: true, activities: activities.length, years: Object.keys(pages).length });
  } catch (err) {
    console.error("Refresh error:", err);
    return Response.json({ ok: false, error: "Failed to fetch activities" }, { status: 500 });
  }
};
