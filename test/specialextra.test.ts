// gammainc, erfinv, erfcinv and perm against R (oracle/specialextra.R: pgamma * gamma, pracma's definitions of the
// inverse error functions, Rmpfr for perm), and against mpmath (scripts/mpmath/specialextra.py) where R's values
// lose accuracy
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { erfcinv, erfinv, gammainc, perm } from "../src/special/extra.js";
import { num, relativeError } from "./helpers/fixture.js";
import { htestSuite } from "./helpers/htest.js";
import { loadReference, referenceSuite } from "./helpers/mpmath.js";
import { fixtureSuite } from "./helpers/suite.js";

const gammaincOf = (a: Record<string, unknown>): number[] => {
  const r = gammainc(num(a.x as string), num(a.a as string));
  return [r.lower, r.upper, r.logLower, r.logUpper];
};
const gammaincRef = new Map(
  (JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/gammainc.mpmath.json", import.meta.url)), "utf8")) as {
    cases: { args: Record<string, string>; expected: string[] }[];
  }).cases.map((c) => [JSON.stringify(c.args), c.expected.map((v) => num(v))]),
);
const agrees = (actual: number, ref: number | undefined): boolean =>
  ref !== undefined && (Object.is(actual, ref) || relativeError(actual, ref) <= 1e-14 || Math.abs(actual - ref) <= 1e-14 * Math.max(1, Math.abs(ref)));

htestSuite({
  name: "gammainc",
  call: gammaincOf,
  tolerance: 1e-14,
  // R multiplies pgamma and gamma, each rounded (and gamma(a) itself carries a few ulp)
  knownDifference: (a, field, _e, actual) =>
    agrees(actual, gammaincRef.get(JSON.stringify(a))?.[Number(field)]) ? "pgamma * gamma rounds twice in R (agrees with mpmath)" : undefined,
});

describe("gammainc", () => {
  it("matches the high-precision values (mpmath)", () => {
    const bad: string[] = [];
    for (const [k, ref] of gammaincRef) {
      const act = gammaincOf(JSON.parse(k) as Record<string, unknown>);
      ref.forEach((r, i) => {
        if (!agrees(act[i]!, r)) bad.push(`${k}[${i}]: ${r} / ${act[i]}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

const refDifference = (name: string) => {
  const ref = new Map(loadReference(name).cases.map((c) => [JSON.stringify(c.args), num(c.expected)]));
  return (a: Record<string, string | boolean>, _e: number, actual: number): string | undefined =>
    agrees(actual, ref.get(JSON.stringify(a))) ? "pracma's form through qnorm((1 - |y|) / 2) loses small |y| (agrees with mpmath)" : undefined;
};

fixtureSuite({ name: "erfinv", tolerance: 1e-14, call: (a) => erfinv(num(a.y)), knownDifference: refDifference("erfinv") });
fixtureSuite({ name: "erfcinv", tolerance: 1e-14, call: (a) => erfcinv(num(a.y)), knownDifference: refDifference("erfcinv") });
referenceSuite({ name: "erfinv", tolerance: 1e-15, call: (a) => erfinv(num(a.y)) });
referenceSuite({ name: "erfcinv", tolerance: 1e-15, call: (a) => erfcinv(num(a.y)) });
fixtureSuite({ name: "perm", tolerance: 1e-15, call: (a) => perm(num(a.n), num(a.k)) });
