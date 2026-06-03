/**
 * Identifiers. The ULID is the canonical, immutable, time-sortable id for every
 * note/event/fact/entity. Aligns with the `ulid` $defs in the JSON schemas
 * (pattern ^[0-7][0-9A-HJKMNP-TV-Z]{25}$). It is the durable key, never the
 * retrieval mechanism (retrieval uses metadata/tags/links/entities + indexes).
 */

/** A 26-char Crockford-base32 ULID. Branded so a raw string can't be passed by mistake. */
export type Ulid = string & { readonly __brand: "Ulid" };

/** Canonical ULID shape (uppercase Crockford base32, first char 0-7). */
export const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** Runtime guard — narrows an unknown string to a `Ulid`. */
export function isUlid(value: string): value is Ulid {
  return ULID_PATTERN.test(value);
}

/** A pointer into external secure storage (never inline sensitive content). */
export type SecureRef = string & { readonly __brand: "SecureRef" };

export const SECURE_REF_PATTERN = /^secref_[A-Za-z0-9_-]+$/;
