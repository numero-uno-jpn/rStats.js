// The matrix exponential (expm::expm, all six methods: "Higham08.b", "Higham08", "Pade", "Taylor", "PadeO",
// "TaylorO", the last four with the default order 8) against R (oracle/matfn.R), by the rules of
// oracle/matfn-behaviour.md: every entry within a relative 1e-12 of R's (the fixture comes from x86_64 R: arm64 R's
// Fortran fuses multiply-adds in the Padé and Taylor methods, which moved one entry made by cancellation by 1e-11).
// The symmetric cases' exact references (Rmpfr) are compared for information only.
import { describe, expect, it } from "vitest";
import { expm, type ExpmMethod } from "../src/index.js";
import { arg, loadHTestFixture } from "./helpers/htest.js";

const TOL = 1e-12;
const relativeError = (a: number, e: number): number => (a === e ? 0 : Math.abs(a - e) / Math.abs(e));
const METHODS: readonly ExpmMethod[] = ["Higham08.b", "Higham08", "Pade", "Taylor", "PadeO", "TaylorO"];
const fixture = loadHTestFixture("expm");
const mat = (v: unknown): number[][] => arg.mat(v as string[][])!;

describe("expm", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const failures: string[] = [];
    const compared = new Map<string, number>(METHODS.map((m) => [m, 0]));
    const worstRel = new Map<string, number>(METHODS.map((m) => [m, 0]));
    const worstRef = new Map<string, number>(METHODS.map((m) => [m, 0]));
    fixture.cases.forEach((c, index) => {
      const method = c.args.method as ExpmMethod;
      expect(METHODS).toContain(method);
      compared.set(method, compared.get(method)! + 1);
      const actual = expm(mat(c.args.x), { method });
      const expected = mat(c.expected.value);
      const reference = c.reference === undefined ? undefined : mat(c.reference.value);
      expected.forEach((row, i) =>
        row.forEach((e, j) => {
          const a = actual[i]![j]!;
          const label = `#${index} ${method} [${i + 1}, ${j + 1}]: R ${e} / TS ${a}`;
          const rel = relativeError(a, e);
          if (rel <= TOL) worstRel.set(method, Math.max(worstRel.get(method)!, rel));
          else failures.push(`${label} (rel ${rel.toExponential(2)})`);
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
      ].join("\n"),
    );
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
