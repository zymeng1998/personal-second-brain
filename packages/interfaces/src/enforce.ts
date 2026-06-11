/**
 * Scope enforcement at the operations boundary (SB-073, OQ #13/#27).
 * Every CLI command entry point calls `enforceScope(caller, …)` before doing
 * anything; the caller's grant comes from the first-party registry and is
 * resolved by the SAME pure `grantAllows` for everyone — including `cli`.
 * There is deliberately NO environment inspection here: no env/test/dev flag
 * can bypass enforcement.
 */
import { OPERATION_CONTRACTS } from "./operations.js";
import type { CoreOperations } from "./operations.js";
import { grantFor } from "./grants.js";
import { grantAllows } from "./scope.js";
import type { PermissionScope } from "./scope.js";

export class ScopeDeniedError extends Error {
  readonly code = "scope_denied";
  readonly details: { caller: string; scope: string };

  constructor(caller: string, scope: string) {
    // audit-friendly and leak-free: names the caller + scope, never payloads
    super(`scope denied: caller '${caller}' lacks '${scope}'`);
    this.name = "ScopeDeniedError";
    this.details = { caller, scope };
  }
}

/**
 * Throw `ScopeDeniedError` unless `caller`'s grant covers the operation.
 * `operation` is either a `CoreOperations` key (its contract supplies the
 * scope) or a raw `PermissionScope` (for write paths without a descriptor,
 * e.g. the promote path's `write:notes`). An unknown operation name is
 * DENIED, never silently allowed.
 */
export function enforceScope(
  caller: string,
  operation: keyof CoreOperations | PermissionScope,
): void {
  let scope: PermissionScope;
  if ((operation as string).includes(":")) {
    scope = operation as PermissionScope;
  } else {
    const contract = OPERATION_CONTRACTS[operation as keyof CoreOperations];
    if (contract === undefined) {
      throw new ScopeDeniedError(caller, `unknown operation '${String(operation)}'`);
    }
    scope = contract.scope;
  }
  if (!grantAllows(grantFor(caller), scope)) {
    throw new ScopeDeniedError(caller, scope);
  }
}
