// The matrix exponential (expm::expm, all six methods: "Higham08.b", "Higham08", "Pade", "Taylor", "PadeO",
// "TaylorO", the last four with the default order 8) against R (oracle/matfn.R), by the rules of
// oracle/matfn-behaviour.md: every entry within a relative 1e-12 of R's, except the entries listed in CANCELLATION,
// which are compared within 1e-12 × the largest absolute entry of R's result (the specification's rule for entries
// near 0 by cancellation). The symmetric cases' exact references (Rmpfr) are compared for information only.
import { describe, expect, it } from "vitest";
import { expm, type ExpmMethod } from "../src/index.js";
import { arg, loadHTestFixture } from "./helpers/htest.js";

const TOL = 1e-12;
const relativeError = (a: number, e: number): number => (a === e ? 0 : Math.abs(a - e) / Math.abs(e));
const METHODS: readonly ExpmMethod[] = ["Higham08.b", "Higham08", "Pade", "Taylor", "PadeO", "TaylorO"];
/**
 * Entries "case index:row,column" (1-based row and column) compared by the cancellation rule. The 5 × 5 case's entry
 * [4, 5] is 0.333 while the result's entries reach 80.6, and it comes out of sums of terms of size about 20; in the
 * Padé and Taylor methods R's arm64 build fuses multiply-adds in the products, inner products and updates (emulating
 * that reproduces R's results for these methods bit for bit), which moves this entry by up to 1e-11 relative (4e-14 of
 * the largest entry). R's own Higham08 and Pade values for it differ by 9e-12 relative.
 */
const CANCELLATION = new Set(["38:4,5", "39:4,5", "40:4,5", "41:4,5"]);
const fixture = loadHTestFixture("expm");
const mat = (v: unknown): number[][] => arg.mat(v as string[][])!;

describe("expm", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const compared = new Map<string, number>(METHODS.map((m) => [m, 0]));
    const worstRel = new Map<string, number>(METHODS.map((m) => [m, 0]));
    const worstRef = new Map<string, number>(METHODS.map((m) => [m, 0]));
    let worstCancellation = 0;
    fixture.cases.forEach((c, index) => {
      const method = c.args.method as ExpmMethod;
      expect(METHODS).toContain(method);
      compared.set(method, compared.get(method)! + 1);
      const actual = expm(mat(c.args.x), { method });
      const expected = mat(c.expected.value);
      const reference = c.reference === undefined ? undefined : mat(c.reference.value);
      const largest = Math.max(...expected.flat().map(Math.abs));
      expected.forEach((row, i) =>
        row.forEach((e, j) => {
          const a = actual[i]![j]!;
          const label = `#${index} ${method} [${i + 1}, ${j + 1}]: R ${e} / TS ${a}`;
          if (CANCELLATION.has(`${index}:${i + 1},${j + 1}`)) {
            const err = Math.abs(a - e) / largest;
            if (err <= TOL) worstCancellation = Math.max(worstCancellation, err);
            else failures.push(`${label} (${err.toExponential(2)} of the largest entry)`);
          } else {
            const rel = relativeError(a, e);
            if (rel <= TOL) worstRel.set(method, Math.max(worstRel.get(method)!, rel));
            else failures.push(`${label} (rel ${rel.toExponential(2)})`);
          }
          if (reference) worstRef.set(method, Math.max(worstRef.get(method)!, relativeError(a, reference[i]![j]!)));
        }),
      );
    });
    console.log(
      [
        `expm: ${fixture.cases.length} cases compared; max relative error vs R / vs the exact references (symmetric cases):`,
        ...METHODS.map(
          (m) =>
            `  ${m} (${compared.get(m)} cases): ${worstRel.get(m)!.toExponential(1)} / ${worstRef.get(m)!.toExponential(1)}`,
        ),
        `  the ${CANCELLATION.size} entries near 0 by cancellation: ${worstCancellation.toExponential(1)} of the largest entry`,
      ].join("\n"),
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
