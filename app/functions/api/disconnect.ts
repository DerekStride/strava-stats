import { refreshTokens, deauthorize } from "../../src/strava";
import { getSession, clearSession } from "../../src/session";
import type { Env, UserRow } from "../../src/types";

// POST /api/disconnect — revoke Strava access and delete all user data
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
    // Revoke access at Strava
    const { accessToken } = await refreshTokens(user, context.env);
    await deauthorize(accessToken);
  } catch {
    // Continue with deletion even if deauth fails
  }

  // Delete all user data (CASCADE deletes rendered_pages too)
  await context.env.DB.prepare("DELETE FROM users WHERE id = ?")
    .bind(user.id)
    .run();

  const url = new URL(context.request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/`,
      "Set-Cookie": clearSession(),
    },
  });
};
