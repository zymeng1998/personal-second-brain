/**
 * Minimal, dependency-free ULID generator (Crockford base32, 48-bit time +
 * 80-bit randomness). Output matches the canonical ULID pattern enforced by
 * `@sb/interfaces` (`^[0-7][0-9A-HJKMNP-TV-Z]{25}$`). Not a custom id system —
 * just the standard ULID encoding, kept local to avoid a dependency.
 */
import { randomFillSync } from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I, L, O, U)
const TIME_LEN = 10;
const RAND_LEN = 16;

function encodeTime(now: number): string {
  let out = "";
  let n = now;
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = n % 32;
    out = ENCODING.charAt(mod) + out;
    n = (n - mod) / 32;
  }
  return out;
}

function encodeRandom(): string {
  // 256 % 32 === 0, so byte % 32 is uniform — no modulo bias.
  const bytes = randomFillSync(new Uint8Array(RAND_LEN));
  let out = "";
  for (const byte of bytes) out += ENCODING.charAt(byte % 32);
  return out;
}

/** Generate a canonical 26-char ULID. */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}
