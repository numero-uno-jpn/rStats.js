// factanal against R (oracle/optim.R, x86_64 R; rules in oracle/factanal-behaviour.md, "Accuracy"): every value
// within a relative 1e-12, loadings with each column's sum positive (as the fixture writes them)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factanal, type FactanalRotation } from "../src/index.js";
import { num, relativeError } from "./helpers/fixture.js";

interface Case {
  args: Record<string, unknown>;
  expected: Record<string, unknown>;
}
const cases = (JSON.parse(readFileSync(new URL("./fixtures/factanal.json", import.meta.url), "utf8")) as { cases: Case[] }).cases;
const mat = (a: unknown): number[][] => (a as string[][]).map((r) => r.map((v) => num(v)));
const TOL = 1e-12;

describe("factanal against R", () => {
  let maxErr = 0;
  cases.forEach((c, k) => {
    const a = c.args;
    it(`${k}: ${a.covmat !== undefined ? "covmat" : "x"} factors ${a.factors as string} ${a.rotation as string}`, () => {
      const run = () =>
        a.covmat !== undefined
          ? factanal(null, num(a.factors as string), { covmat: mat(a.covmat), nObs: num(a["n.obs"] as string), rotation: a.rotation as FactanalRotation })
          : factanal(mat(a.x), num(a.factors as string), { rotation: a.rotation as FactanalRotation });
      const e = c.expected;
      if (e.error !== undefined) {
        expect(run).toThrow(e.error as string);
        return;
      }
      const r = run();
      const failures: string[] = [];
      const check = (what: string, actual: number, expected: number) => {
        const err = relativeError(actual, expected);
        maxErr = Math.max(maxErr, err);
        if (!(err <= TOL)) failures.push(`${what}: ${actual} vs ${expected} (${err.toExponential(2)})`);
      };
      (e.uniquenesses as string[]).forEach((v, i) => check(`uniquenesses[${i}]`, r.uniquenesses[i]!, num(v)));
      mat(e.loadings).forEach((row, i) => row.forEach((v, j) => check(`loadings[${i}][${j}]`, r.loadings[i]![j]!, v)));
      check("STATISTIC", r.STATISTIC, num(e.STATISTIC as string));
      check("dof", r.dof, num(e.dof as string));
      check("PVAL", r.PVAL, num(e.PVAL as string));
      expect(r.converged).toBe(e.converged);
      expect(failures).toEqual([]);
    });
  });
  it("summary", () => console.log(`factanal: ${cases.length} cases, max error ${maxErr.toExponential(2)}`));
});

describe("factanal arguments", () => {
  it("errors as R", () => {
    const x = [[1, 2], [2, 1], [3, 5], [4, 3]];
    expect(() => factanal(x, 1)).toThrow("factor analysis requires at least three variables");
  });
});
