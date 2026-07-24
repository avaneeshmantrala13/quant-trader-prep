/**
 * Password hashing for the local-first MVP. Uses the Web Crypto SubtleCrypto
 * SHA-256 over `salt:password` with a random per-user salt. This keeps plaintext
 * passwords out of localStorage. It is NOT a substitute for a real server-side
 * KDF (bcrypt/scrypt/argon2) — when this app swaps to Firebase Auth, password
 * handling moves server-side entirely and this module is dropped.
 */

export function randomSalt(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  // Constant-time-ish comparison.
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}
