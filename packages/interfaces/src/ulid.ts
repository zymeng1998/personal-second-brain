/**
 * Canonical ULID generator — the single core implementation shared by the CLI,
 * event-log, and projection stores (SB-034 centralization; retires the
 * previously duplicated `apps/cli/src/ulid.ts`).
 *
 * Dependency-free, standard ULID encoding: 48-bit millisecond time + 80-bit
 * randomness, Crockford base32. Output matches `ULID_PATTERN`
 * (`^[0-7][0-9A-HJKMNP-TV-Z]{25}$`) — i.e. `isUlid()` accepts every value it
 * produces. Not a custom id scheme — just the standard encoding kept local to
 * avoid a runtime dependency.
 */
import { randomFillSync } from "node:crypto";
import type { Ulid } from "./ids.js";

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

/** Generate a canonical 26-char ULID (branded). */
export function ulid(now: number = Date.now()): Ulid {
  return (encodeTime(now) + encodeRandom()) as Ulid;
}
