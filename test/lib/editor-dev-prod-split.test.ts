import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guard for the dev-editor / prod-no-editor split.
 *
 * The rule this protects: `npm run dev` may edit content, a deployed site must not. Nothing here changes how
 * `ENABLE_CONTENT_EDITOR` is read - it only proves the two properties that make the rule hold cannot be broken
 * by a careless edit:
 *
 *   1. The local files really do carry the split (`.env.local` on, `.env` off), so dev and a local prod-mode
 *      run behave as intended.
 *   2. Nothing in the repo can turn the flag on for a deployed environment - no committed env file sets it to
 *      "true", and the code never defaults it on.
 *
 * Why the second point is safe even though Vite loads `.env` and `.env.local` "in all cases" (including
 * `vite build`): private variables are not baked into the bundle. Kit's generated server chunk starts as
 * `dynamic_private_env = {}` and only fills it through `set_env(env)`, which adapter-vercel calls with the
 * platform's own environment at server init. Vercel deploys carry no `.env` files, so a deployed value can come
 * only from Vercel's own settings - never from this repo.
 */

const repoRoot = resolve(process.cwd());
const read = (relative: string) =>
  readFileSync(resolve(repoRoot, relative), "utf8");

/** Parse the `NAME=value` lines of an env file, ignoring comments and blanks. */
const parseEnvFile = (relative: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const line of read(relative).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim();
  }
  return values;
};

const FLAG = "ENABLE_CONTENT_EDITOR";

describe("editor dev/prod split", () => {
  it("keeps the editor on for local dev and a local prod-mode run", () => {
    const local = parseEnvFile(".env.local");

    expect(local[FLAG]).toBe("true");
    // The flag is useless without these two, so the guard checks them too: an enabled-but-locked editor is the
    // `no-session` state a dev mistakes for a broken build.
    expect((local.EDITOR_EDIT_KEY ?? "").trim().length).toBeGreaterThan(0);
    expect((local.EDITOR_SESSION_SECRET ?? "").trim().length).toBeGreaterThan(
      0,
    );
  });

  it("keeps the committed .env closed so the flag cannot default to on", () => {
    const committed = parseEnvFile(".env");

    expect(committed[FLAG]).toBe("false");
  });

  it("ships no committed env file that could turn the editor on in a deploy", () => {
    // .env.example is names-only by design. If someone ever fills in a real "true" there, it is not loaded at
    // runtime - but copying it to .env.local would then silently open a deploy's local build too.
    const example = read(".env.example");
    const flagLines = example
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith(`${FLAG}=`));

    expect(flagLines.length).toBe(1);
    expect(flagLines[0]).toBe(`${FLAG}=`);
  });

  it("never defaults the flag on - only an explicit 'true' enables it", async () => {
    const authSource = read("src/lib/editing/core/auth.server.ts");

    // One comparison, against a literal. Anything looser (|| true, ?? true, !== "false") would make an absent
    // variable mean enabled, which is exactly the failure mode a deploy must not have.
    expect(authSource).toContain('ENABLE_CONTENT_EDITOR?.trim() === "true"');
    expect(authSource).not.toMatch(/ENABLE_CONTENT_EDITOR[^\n]*\|\|/);
    expect(authSource).not.toMatch(/ENABLE_CONTENT_EDITOR[^\n]*!==/);
  });

  it("declares the flag as a runtime-read private variable, not a build-baked one", () => {
    const envDeclaration = read("src/env.ts");

    // A private variable is resolved from the platform environment at server init. If this ever moved to
    // `$app/env/public` or a `VITE_` prefix, the value would be statically bundled - and the local dev value
    // would travel to production inside the client bundle.
    expect(envDeclaration).toContain(`${FLAG}: {`);
    expect(envDeclaration).not.toMatch(/ENABLE_CONTENT_EDITOR:\s*{\s*public/);

    const flagEntry = envDeclaration.slice(
      envDeclaration.indexOf(`${FLAG}:`),
      envDeclaration.indexOf("CONTENT_LIVE_SOURCE:"),
    );
    expect(flagEntry).toContain("Read at runtime");
  });

  it("keeps the client bundle free of the private editor variables", () => {
    // The flag is read by server modules only. A public page that imported `$app/env/private` would receive a
    // compile error rather than a value, but asserting here documents why the split survives bundling.
    const serverModules = [
      "src/lib/editing/core/auth.server.ts",
      "src/lib/editing/core/session.server.ts",
    ];
    for (const file of serverModules) {
      const source = read(file);
      expect(source).toContain("$app/env/private");
      // Importing the public half would expose the value in the client bundle.
      expect(source).not.toMatch(/from\s+"\$app\/env\/public"/);
    }
  });

  it("documents the split in .env.example so a new deploy reads the right instruction", () => {
    const example = read(".env.example").toLowerCase();

    // The trap this guards against: believing a value written into a local .env reaches a deployed server.
    expect(example).toContain("environment variables");
    expect(example).toMatch(
      /not available to the deployed server|platform's own environment/,
    );
  });
});
