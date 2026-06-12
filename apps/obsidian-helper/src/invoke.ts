/**
 * The helper's ONLY route into the core (OQ #32/#34): programmatic
 * `main(argv, io, caller)` under the fixed `surface:obsidian-helper`
 * identity. Same resolver/enforcer as every caller; an ungranted scope ⇒
 * structured `scope_denied`, nothing performed. No second path exists.
 */
import { main } from "@sb/cli";
import { DOMAIN_APP_ID_PATTERN } from "@sb/interfaces";

export const HELPER_CALLER = "surface:obsidian-helper";

// surfaces are first-party: NOT in the config-grantable domain-app namespace
if (DOMAIN_APP_ID_PATTERN.test(HELPER_CALLER)) {
  throw new Error(`surface identity must not be a domain-app id: ${HELPER_CALLER}`);
}

export interface InvokeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function invoke(argv: string[]): Promise<InvokeResult> {
  let stdout = "";
  let stderr = "";
  const exitCode = await main(
    argv,
    {
      out: (text: string) => {
        stdout += text;
      },
      err: (text: string) => {
        stderr += text;
      },
    },
    HELPER_CALLER,
  );
  return { exitCode, stdout, stderr };
}
