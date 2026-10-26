// docs/r-functions.md (and its Japanese version, docs/ja/r-functions.md, which has its own introduction) is the output
// of scripts/r-index.mjs; regenerate it with `node scripts/r-index.mjs > docs/r-functions.md` and copy the tables into
// the Japanese file after a change of the doc comments.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const generated = execFileSync(process.execPath, ["scripts/r-index.mjs"], { cwd: root, encoding: "utf8" });
const tables = (s: string): string => s.slice(s.indexOf("\n## "));

describe("docs/r-functions.md", () => {
  it("is the current output of scripts/r-index.mjs", () => {
    expect(readFileSync(`${root}/docs/r-functions.md`, "utf8")).toBe(generated);
  });
  it("has the same tables in Japanese", () => {
    expect(tables(readFileSync(`${root}/docs/ja/r-functions.md`, "utf8"))).toBe(tables(generated));
  });
});
