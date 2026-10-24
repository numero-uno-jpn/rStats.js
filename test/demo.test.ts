// The demo's examples (demo/examples.json): demo/examples.R is up to date, every export is
// demonstrated, and each example's JavaScript gives R's numbers (demo/r-results.json, written
// by oracle/demo.R; regenerate with `npm run demo:r`).

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as lib from "../src/index.js";

interface Example {
  id: string;
  tab: "distributions" | "special" | "random" | "tests" | "linalg";
  title: { en: string; ja: string };
  js: string;
  r: string;
  tol?: number;
}

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const { examples } = JSON.parse(readFileSync(path("demo/examples.json"), "utf8")) as { examples: Example[] };
const rResults = (JSON.parse(readFileSync(path("demo/r-results.json"), "utf8")) as {
  results: Record<string, string[] | { error: string }>;
}).results;

const names = Object.keys(lib);

/**
 * Exports added since the last release. The public demo loads the released build from jsDelivr, so their examples
 * (with R results from `npm run demo:r`) are added when the next version is tagged; until then they are listed here
 */
const NOT_IN_DEMO_YET = [
  "choose", "lchoose", "factorial", "lfactorial", "digamma", "trigamma", "psigamma", "besselI", "besselK", "besselJ", "besselY", "dmultinom", "erf", "erfc",
  // descriptive statistics (demo tab to come)
  "sum", "prod", "mean", "weightedMean", "variance", "sd", "median", "range", "cumsum", "cumprod", "cummax", "cummin", "diff",
  "quantile", "IQR", "fivenum", "mad", "rank", "cov", "tabulate", "table", "unique", "cut", "findInterval", "hist", "pretty",
  "ecdf", "skewness", "kurtosis", "geometricMean", "modes", "meanAD", "cv", "scale",
  // matrix arithmetic (demo to come)
  "matMul", "add", "subtract", "multiply", "divide", "outer", "t", "diag", "cbind", "rbind", "matrix", "kronecker", "seq",
  "lu", "prcomp",
];
const fns = names.map((n) => (lib as Record<string, unknown>)[n]);

/** Evaluates an example's js with every export in scope and flattens the result to numbers */
function run(js: string): number[] {
  const v = new Function(...names, `return (${js});`)(...fns) as number | number[] | Float64Array;
  return typeof v === "number" ? [v] : Array.from(v);
}

/** R's number strings (num2str in oracle/_random.R) */
const parseR = (s: string) => ({ Inf: Infinity, "-Inf": -Infinity, NA: NaN, NaN: NaN })[s] ?? Number(s);

describe("demo examples", () => {
  it("demo/examples.R is up to date with demo/examples.json", () => {
    expect(() => execFileSync("node", [path("scripts/demo-examples.mjs"), "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("ids are unique and every example has an R result", () => {
    expect(new Set(examples.map((e) => e.id)).size).toBe(examples.length);
    for (const e of examples) expect(Array.isArray(rResults[e.id]), e.id).toBe(true);
  });

  it("every export of src/index.ts appears in some example", () => {
    // Value exports only: skip `export type { ... }` and `type X` entries. src/index.ts re-exports the area
    // modules of src/entries/
    const source = readdirSync(path("src/entries"))
      .map((f) => readFileSync(path(`src/entries/${f}`), "utf8"))
      .join("\n");
    const exported = [...source.matchAll(/^export \{([^}]*)\}/gm)]
      .flatMap((m) => m[1]!.split(","))
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("type "));
    expect(exported.sort()).toEqual([...names].sort());
    const used = new Set(examples.flatMap((e) => e.js.match(/[A-Za-z_$][\w$]*/g) ?? []));
    expect(exported.filter((n) => !used.has(n) && !NOT_IN_DEMO_YET.includes(n))).toEqual([]);
  });

  for (const e of examples) {
    it(`${e.id} matches R`, () => {
      const expected = (rResults[e.id] as string[]).map(parseR);
      const actual = run(e.js);
      expect(actual.length).toBe(expected.length);
      // Random examples must reproduce R's stream to the last bits
      const tol = e.tol ?? (e.tab === "random" ? 1e-15 : 1e-12);
      actual.forEach((a, i) => {
        const r = expected[i]!;
        if (!Number.isFinite(r)) return expect(Object.is(a, r) || (Number.isNaN(a) && Number.isNaN(r)), `${e.id}[${i}]`).toBe(true);
        const err = r === 0 ? Math.abs(a) : Math.abs(a - r) / Math.abs(r);
        expect(err, `${e.id}[${i}]: ${a} vs R ${r}`).toBeLessThanOrEqual(tol);
      });
    });
  }
});
