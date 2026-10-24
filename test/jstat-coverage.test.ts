// Coverage of jStat: every public jStat function (test/fixtures/jstat-api.json, from docs/plans/jstat-inventory.md)
// has a row in the migration guide, and the guide is up to date with the exports (scripts/jstat-guide.mjs marks a row
// "planned" while a function it names is not exported). Covering jStat is complete when no row is planned.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain JavaScript module without types
import { render } from "../scripts/jstat-guide.mjs";

/** Rows still marked planned; lower this as functions are added, down to 0 */
const PLANNED_AT_MOST = 119;

const path = (p: string): string => fileURLToPath(new URL(`../${p}`, import.meta.url));
const api = JSON.parse(readFileSync(path("test/fixtures/jstat-api.json"), "utf8")) as { groups: Record<string, string[]> };
const names = Object.values(api.groups).flat();

describe("jStat coverage", () => {
  for (const [lang, file] of [
    ["en", "docs/migrating-from-jstat.md"],
    ["ja", "docs/ja/migrating-from-jstat.md"],
  ] as const) {
    const md = readFileSync(path(file), "utf8");
    it(`${file} has a row for every jStat function`, () => {
      const rows = new Set([...md.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]));
      expect(names.filter((n) => !rows.has(n))).toEqual([]);
    });
    it(`${file} is up to date (node scripts/jstat-guide.mjs)`, () => {
      const { md: fresh, planned } = render(lang) as { md: string; planned: number };
      expect(md).toBe(fresh);
      console.log(`${file}: ${planned} of ${names.length} jStat functions planned`);
      expect(planned).toBeLessThanOrEqual(PLANNED_AT_MOST);
    });
  }
});
