import { buildAuthUrl } from "../../src/strava";
import type { Env } from "../../src/types";

// GET /auth/strava — redirect user to Strava's OAuth page
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const redirectUri = `${url.origin}/auth/callback`;
  const authUrl = buildAuthUrl(context.env, redirectUri);

  return Response.redirect(authUrl, 302);
};
