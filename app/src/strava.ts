import { encrypt, decrypt } from "./crypto";
import type {
  Env,
  UserRow,
  StravaTokenResponse,
  StravaActivity,
  Activity,
} from "./types";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_DEAUTH_URL = "https://www.strava.com/oauth/deauthorize";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const METERS_TO_KM = 0.001;

export function buildAuthUrl(env: Env, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,activity:read_all",
    approval_prompt: "auto",
  });
  return `${STRAVA_AUTH_URL}?${params}`;
}

export async function exchangeCode(
  code: string,
  env: Env
): Promise<StravaTokenResponse> {
  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava token exchange failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

export async function refreshTokens(
  user: UserRow,
  env: Env
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const currentRefreshToken = await decrypt(user.refresh_token, env.ENCRYPTION_KEY);

  // If token is still valid, just decrypt and return
  if (user.token_expires_at > Math.floor(Date.now() / 1000) + 60) {
    return {
      accessToken: await decrypt(user.access_token, env.ENCRYPTION_KEY),
      refreshToken: currentRefreshToken,
      expiresAt: user.token_expires_at,
    };
  }

  // Token expired — refresh it
  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: currentRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    throw new Error(`Strava token refresh failed: ${resp.status}`);
  }

  const data: StravaTokenResponse = await resp.json();

  // Strava may rotate the refresh token — always save the new one
  const encAccess = await encrypt(data.access_token, env.ENCRYPTION_KEY);
  const encRefresh = await encrypt(data.refresh_token, env.ENCRYPTION_KEY);

  await env.DB.prepare(
    "UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = unixepoch() WHERE id = ?"
  )
    .bind(encAccess, encRefresh, data.expires_at, user.id)
    .run();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

export async function fetchAllActivities(
  accessToken: string
): Promise<Activity[]> {
  const activities: Activity[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const resp = await fetch(
      `${STRAVA_API_BASE}/athlete/activities?per_page=${perPage}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!resp.ok) {
      throw new Error(`Strava API error: ${resp.status}`);
    }

    const batch: StravaActivity[] = await resp.json();
    if (batch.length === 0) break;

    for (const a of batch) {
      activities.push({
        date: a.start_date_local.slice(0, 10), // "YYYY-MM-DD"
        type: a.sport_type,
        name: a.name,
        distance_km: Math.round((a.distance || 0) * METERS_TO_KM * 10) / 10,
        moving_time_minutes: Math.round((a.moving_time || 0) / 60),
        elevation_gain_meters: Math.round(a.total_elevation_gain || 0),
      });
    }

    if (batch.length < perPage) break;
    page++;
  }

  return activities;
}

export async function deauthorize(accessToken: string): Promise<void> {
  await fetch(STRAVA_DEAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
