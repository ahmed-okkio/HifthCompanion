// Git worktree setup: copy the main checkout's node_modules instead of a network install.
// A copy, not a symlink: Turbopack rejects a node_modules that points outside the project root.
// Run: npm run worktree:deps. ponytail: assumes the lockfile matches main's; run `npm ci` if it diverges.
import { execSync, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const main = dirname(resolve(execSync("git rev-parse --git-common-dir").toString().trim()));
const src = resolve(main, "node_modules");
const dest = resolve("node_modules");
if (main === resolve(".")) throw new Error("Already in the main checkout.");
if (!existsSync(src)) throw new Error(`No node_modules in ${main}; run npm ci there first.`);

if (process.platform === "win32") {
  // robocopy: multithreaded, far faster than cpSync on Windows. Exit codes < 8 are success.
  const { status } = spawnSync("robocopy", [src, dest, "/MIR", "/MT:32", "/NFL", "/NDL", "/NJH", "/NP"], { stdio: "inherit" });
  if (status >= 8) process.exit(status);
} else {
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
}
console.log(`Copied ${src} -> ${dest}`);
