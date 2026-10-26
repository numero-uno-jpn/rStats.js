// The matrix exponential (expm::expm, methods "Higham08.b" and "Higham08") against R (oracle/matfn.R), by the rules of
// oracle/matfn-behaviour.md: every entry within a relative 1e-12 of R's (the specification also allows 1e-12 × the
// largest absolute entry where R's entry is near 0 by cancellation; no entry of the fixture needs that, so it is not
// used). The symmetric cases' exact references (Rmpfr) are compared for information only. The fixture's other
// methods (Pade, Taylor, PadeO, TaylorO) are not implemented yet and are skipped.
import { describe, expect, it } from "vitest";
import { expm, type ExpmMethod } from "../src/index.js";
import { arg, loadHTestFixture } from "./helpers/htest.js";

const TOL = 1e-12;
const relativeError = (a: number, e: number): number => (a === e ? 0 : Math.abs(a - e) / Math.abs(e));
const METHODS: readonly string[] = ["Higham08.b", "Higham08"];
const fixture = loadHTestFixture("expm");
const mat = (v: unknown): number[][] => arg.mat(v as string[][])!;

describe("expm", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let compared = 0;
    let skipped = 0;
    let worstRel = 0;
    let worstRef = 0;
    fixture.cases.forEach((c, index) => {
      const method = c.args.method as string;
      if (!METHODS.includes(method)) {
        skipped++;
        return;
      }
      compared++;
      const actual = expm(mat(c.args.x), { method: method as ExpmMethod });
      const expected = mat(c.expected.value);
      const reference = c.reference === undefined ? undefined : mat(c.reference.value);
      expected.forEach((row, i) =>
        row.forEach((e, j) => {
          const a = actual[i]![j]!;
          const rel = relativeError(a, e);
          if (rel <= TOL) worstRel = Math.max(worstRel, rel);
          else failures.push(`#${index} ${method} [${i + 1}, ${j + 1}]: R ${e} / TS ${a} (rel ${rel.toExponential(2)})`);
          if (reference) worstRef = Math.max(worstRef, relativeError(a, reference[i]![j]!));
        }),
      );
    });
    console.log(
      [
        `expm: ${compared} cases compared (${skipped} cases of the methods Pade, Taylor, PadeO, TaylorO skipped: not implemented yet)`,
        `  max relative error vs R: ${worstRel.toExponential(1)}; vs the exact references (symmetric cases): ${worstRef.toExponential(1)}`,
      ].join("\n"),
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
