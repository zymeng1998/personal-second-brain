/**
 * The dashboard's ONLY route into the core (OQ #32/#33): programmatic
 * `main(argv, io, caller)` under the fixed `surface:dashboard` identity.
 * Same resolver/enforcer as every caller; ungranted ⇒ `scope_denied`,
 * nothing performed. No second path exists.
 */
import { main } from "@sb/cli";
import { DOMAIN_APP_ID_PATTERN } from "@sb/interfaces";

export const DASHBOARD_CALLER = "surface:dashboard";

if (DOMAIN_APP_ID_PATTERN.test(DASHBOARD_CALLER)) {
  throw new Error(`surface identity must not be a domain-app id: ${DASHBOARD_CALLER}`);
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
    DASHBOARD_CALLER,
  );
  return { exitCode, stdout, stderr };
}
