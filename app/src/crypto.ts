// AES-256-GCM encryption for OAuth tokens using Web Crypto API

const ALGO = "AES-GCM";
const IV_LENGTH = 12;

async function deriveKey(hexKey: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(hexKey.slice(0, 64)); // 32 bytes = 256 bits
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGO }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  plaintext: string,
  hexKey: string
): Promise<string> {
  const key = await deriveKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );

  // Concatenate iv + ciphertext, encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToBase64(combined);
}

export async function decrypt(
  encoded: string,
  hexKey: string
): Promise<string> {
  const key = await deriveKey(hexKey);
  const combined = base64ToBytes(encoded);

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
