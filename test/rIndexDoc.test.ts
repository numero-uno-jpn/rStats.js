// docs/r-functions.md and docs/ja/r-functions.md are the output of scripts/r-index.mjs (English descriptions from the
// doc comments; Japanese ones from docs/ja/r-functions.json, which must describe every exported function). After a
// change of the exports or their doc comments, regenerate them:
//   node scripts/r-index.mjs > docs/r-functions.md && node scripts/r-index.mjs --ja > docs/ja/r-functions.md
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (...args: string[]): string =>
  execFileSync(process.execPath, ["scripts/r-index.mjs", ...args], { cwd: root, encoding: "utf8" });

describe("the R function index", () => {
  it("docs/r-functions.md is the current output of scripts/r-index.mjs", () => {
    expect(readFileSync(`${root}/docs/r-functions.md`, "utf8")).toBe(run());
  });
  it("docs/ja/r-functions.md is the current output of scripts/r-index.mjs --ja (every function described)", () => {
    expect(readFileSync(`${root}/docs/ja/r-functions.md`, "utf8")).toBe(run("--ja"));
  });
});
