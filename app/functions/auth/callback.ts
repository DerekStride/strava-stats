import { exchangeCode } from "../../src/strava";
import { encrypt } from "../../src/crypto";
import { createSession } from "../../src/session";
import type { Env } from "../../src/types";

// GET /auth/callback?code=...&scope=... — Strava redirects here after user approves
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${url.origin}/?error=denied`, 302);
  }

  try {
    const token = await exchangeCode(code, context.env);

    // Encrypt tokens before storing
    const encAccess = await encrypt(token.access_token, context.env.ENCRYPTION_KEY);
    const encRefresh = await encrypt(token.refresh_token, context.env.ENCRYPTION_KEY);

    // Upsert user — if they re-connect, update their tokens
    await context.env.DB.prepare(
      `INSERT INTO users (strava_id, firstname, access_token, refresh_token, token_expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (strava_id) DO UPDATE SET
         firstname = excluded.firstname,
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         token_expires_at = excluded.token_expires_at,
         updated_at = unixepoch()`
    )
      .bind(
        token.athlete.id,
        token.athlete.firstname,
        encAccess,
        encRefresh,
        token.expires_at
      )
      .run();

    // Look up the user row to get the internal ID
    const user = await context.env.DB.prepare(
      "SELECT id, strava_id FROM users WHERE strava_id = ?"
    )
      .bind(token.athlete.id)
      .first<{ id: number; strava_id: number }>();

    if (!user) {
      return new Response("Failed to create user", { status: 500 });
    }

    // Set session cookie and redirect to their page
    const cookie = await createSession(
      { userId: user.id, stravaId: user.strava_id },
      context.env.SESSION_SECRET
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/u/${user.strava_id}`,
        "Set-Cookie": cookie,
      },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return Response.redirect(`${url.origin}/?error=auth_failed`, 302);
  }
};
