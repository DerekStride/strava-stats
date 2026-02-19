export interface Env {
  DB: D1Database;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;
}

export interface UserRow {
  id: number;
  strava_id: number;
  firstname: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
  last_fetched_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface RenderedPageRow {
  id: number;
  user_id: number;
  year: number;
  html: string;
  rendered_at: number;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number;
}

export interface Activity {
  date: string;
  type: string;
  name: string;
  distance_km: number;
  moving_time_minutes: number;
  elevation_gain_meters: number;
}

export interface TypeStats {
  count: number;
  distance_km: number;
  moving_time_hours: number;
  elevation_gain_meters: number;
}

export interface YearStats {
  count: number;
  moving_time_hours: number;
  by_type: Record<string, TypeStats>;
}

export interface Totals {
  count: number;
  distance_km: number;
  moving_time_hours: number;
  elevation_gain_meters: number;
  by_type: Record<string, TypeStats>;
}
