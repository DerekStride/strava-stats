// Signed cookie sessions using HMAC-SHA256
// Cookie format: base64(payload).base64(signature)

const COOKIE_NAME = "session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface SessionData {
  userId: number;
  stravaId: number;
}

async function sign(
  payload: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verify(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await sign(payload, secret);
  return signature === expected;
}

export async function createSession(
  data: SessionData,
  secret: string
): Promise<string> {
  const payload = btoa(JSON.stringify(data));
  const signature = await sign(payload, secret);
  const value = `${payload}.${signature}`;

  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export async function getSession(
  request: Request,
  secret: string
): Promise<SessionData | null> {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;

  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const [payload, signature] = match[1].split(".");
  if (!payload || !signature) return null;

  const valid = await verify(payload, signature, secret);
  if (!valid) return null;

  try {
    return JSON.parse(atob(payload)) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
