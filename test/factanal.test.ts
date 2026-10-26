// factanal against R (oracle/optim.R, x86_64 R; rules in oracle/factanal-behaviour.md, "Accuracy"): every value
// within a relative 1e-12, loadings with each column's sum positive (as the fixture writes them) and also passing
// within 1e-12 times the largest absolute loading of their column, and scores likewise (a score is a sum of terms of
// both signs, so a small one is determined only to about 1e-14 absolutely)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factanal, type FactanalRotation, type FactanalScores } from "../src/index.js";
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
    const scores = a.scores as FactanalScores | undefined;
    it(`${k}: ${a.covmat !== undefined ? "covmat" : "x"} factors ${a.factors as string} ${a.rotation as string}${scores ? ` scores ${scores}` : ""}`, () => {
      const opts = { rotation: a.rotation as FactanalRotation, ...(scores ? { scores } : {}) };
      const run = () =>
        a.covmat !== undefined
          ? factanal(null, num(a.factors as string), { covmat: mat(a.covmat), nObs: num(a["n.obs"] as string), ...opts })
          : factanal(mat(a.x), num(a.factors as string), opts);
      const e = c.expected;
      if (e.error !== undefined) {
        expect(run).toThrow(e.error as string);
        return;
      }
      const r = run();
      const failures: string[] = [];
      const check = (what: string, actual: number, expected: number, scale = 0) => {
        // a loading may also be within 1e-12 times the largest absolute loading of its column
        const err = Math.min(relativeError(actual, expected), scale > 0 ? Math.abs(actual - expected) / scale : Infinity);
        maxErr = Math.max(maxErr, err);
        if (!(err <= TOL)) failures.push(`${what}: ${actual} vs ${expected} (${err.toExponential(2)})`);
      };
      (e.uniquenesses as string[]).forEach((v, i) => check(`uniquenesses[${i}]`, r.uniquenesses[i]!, num(v)));
      const L = mat(e.loadings);
      const colMax = L[0]!.map((_, j) => Math.max(...L.map((row) => Math.abs(row[j]!))));
      L.forEach((row, i) => row.forEach((v, j) => check(`loadings[${i}][${j}]`, r.loadings[i]![j]!, v, colMax[j]!)));
      if (e.scores !== undefined) {
        // a score may also be within 1e-12 times the largest absolute score of its column, as a loading (the
        // smallest scores have relative errors of about 1e-12 from cancellation in z R^-1 L)
        const Sc = mat(e.scores);
        expect(r.scores?.length).toBe(Sc.length);
        const scMax = Sc[0]!.map((_, j) => Math.max(...Sc.map((row) => Math.abs(row[j]!))));
        Sc.forEach((row, i) => row.forEach((v, j) => check(`scores[${i}][${j}]`, r.scores![i]![j]!, v, scMax[j]!)));
      } else expect(r.scores).toBeUndefined();
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
    expect(() => factanal(x, 1, { scores: "Thomson" as FactanalScores })).toThrow("'arg' should be one of");
  });
});
