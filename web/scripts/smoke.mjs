/* Render platform presenters and validate explicit missing-mapping states. */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIB } from "../lib-path.mjs";

const out = join(mkdtempSync(join(tmpdir(), "mari-smoke-")), "smoke.cjs");
const nm = new URL("../node_modules/", import.meta.url).pathname;

/** Kept in step with SHARED_DEPS in vite.config.ts. */
const SHARED_DEPS = [
  "react", "react-dom", "lucide-react",
  "@radix-ui/react-accordion", "@radix-ui/react-checkbox", "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover",
  "@radix-ui/react-progress", "@radix-ui/react-radio-group", "@radix-ui/react-separator",
  "@radix-ui/react-switch", "@radix-ui/react-tabs", "@radix-ui/react-toast",
  "@radix-ui/react-toggle", "@radix-ui/react-toggle-group", "@radix-ui/react-tooltip",
].filter((name) => existsSync(join(nm, name)));

const bundle = spawnSync("npx", [
  "esbuild", "scripts/smoke.tsx",
  "--bundle", "--platform=node", "--format=cjs", "--jsx=automatic",
  `--outfile=${out}`,
  `--alias:@mari-design/components=${LIB}`,
  // The library is source-only in the submodule and sits outside this
  // package's tree, so its bare imports resolve to nothing here. Every shared
  // runtime dep is aliased at THIS app's copy — which also keeps React a
  // single instance ("Invalid hook call" otherwise). Vite does the same thing
  // via resolve.alias; esbuild has no `dedupe`, so it is spelled out.
  ...SHARED_DEPS.map((name) => `--alias:${name}=${nm}${name}`),
  "--log-level=error",
], { stdio: "inherit", shell: process.platform === "win32" });

if (bundle.status !== 0) process.exit(bundle.status ?? 1);
process.exit(spawnSync(process.execPath, [out], { stdio: "inherit" }).status ?? 1);
