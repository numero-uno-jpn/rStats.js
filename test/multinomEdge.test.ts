// Edge cases of multinom (1.14.0): R's answers in experiments/multinom114-edge.json; where R breaks down (covariates
// near 1e+-150 or 1e+-300, a large common offset, weights near 1e+-200) rStats.js is checked for invariance instead.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { multinom } from "../src/entries/regression.js";

const edge = JSON.parse(readFileSync(new URL("../experiments/multinom114-edge.json", import.meta.url), "utf8")) as Record<string, any>;
const d = edge.data;
const rows = (m: { values: number[] }, K1: number, p: number): number[][] =>
  Array.from({ length: K1 }, (_, k) => Array.from({ length: p }, (_, j) => m.values[k + K1 * j]!));
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.max(1, Math.abs(b));

describe("multinom: scales and offsets of a covariate", () => {
  const base = multinom("y ~ x1 + x2", d);
  it("gives R's fit at the ordinary scale", () => {
    const r = edge.x_1_0.value;
    rows(r.coef, 2, 3).forEach((row, k) => row.forEach((v, j) => expect(rel(base.coefficients[k]![j]!, v)).toBeLessThan(1e-6)));
    expect(rel(base.deviance, r.deviance)).toBeLessThan(1e-12);
  });
  it("does not depend on the scale (R's fit breaks down near 1e+-150 and stops near 1e300)", () => {
    for (const a of [1e150, 1e-150, 1e300, 1e-300, 2 ** 1000]) {
      const f = multinom("y ~ x1 + x2", { ...d, x1: d.x1.map((v: number) => v * a) });
      expect(f.converged).toBe(true);
      expect(Math.abs(f.deviance - base.deviance)).toBeLessThan(1e-9);
      f.coefficients.forEach((row, k) => {
        expect(rel(row[1]! * a, base.coefficients[k]![1]!)).toBeLessThan(1e-12);
        expect(rel(row[0]!, base.coefficients[k]![0]!)).toBeLessThan(1e-12);
        expect(rel(f.se[k]![1]! * a, base.se[k]![1]!)).toBeLessThan(1e-12);
      });
    }
  });
  it("keeps the digits of a covariate with a large common offset (R's fit breaks down at 1e8 and 1e15)", () => {
    for (const c of [1e8, 1e15]) {
      const shifted = d.x1.map((v: number) => v + c), exact = shifted.map((v: number) => v - c); // exact (Sterbenz)
      const a = multinom("y ~ x1 + x2", { ...d, x1: shifted }), b = multinom("y ~ x1 + x2", { ...d, x1: exact });
      expect(a.converged).toBe(true);
      expect(Math.abs(a.deviance - b.deviance)).toBeLessThan(1e-9);
      a.coefficients.forEach((row, k) => expect(rel(row[1]!, b.coefficients[k]![1]!)).toBeLessThan(1e-9));
      a.fittedValues.forEach((row, i) => row.forEach((v, l) => expect(Math.abs(v - b.fittedValues[i]![l]!)).toBeLessThan(1e-12)));
    }
  });
});

describe("multinom: weights, columns and levels", () => {
  it("does not depend on the scale of the weights (R's fit breaks down near 1e+-200)", () => {
    const base = multinom("y ~ x1 + x2", { ...d, ws: d.w }, { weights: "ws" });
    const r = edge.w_1.value;
    rows(r.coef, 2, 3).forEach((row, k) => row.forEach((v, j) => expect(rel(base.coefficients[k]![j]!, v)).toBeLessThan(1e-6)));
    for (const c of [1e200, 1e-200]) {
      const f = multinom("y ~ x1 + x2", { ...d, ws: d.w.map((v: number) => v * c) }, { weights: "ws" });
      f.coefficients.flat().forEach((v, i) => expect(Math.abs(v - base.coefficients.flat()[i]!)).toBeLessThan(1e-12));
      // case weights: the variance scales as 1 / c
      f.se.flat().forEach((v, i) => expect(rel(v * Math.sqrt(c), base.se.flat()[i]!)).toBeLessThan(1e-12));
    }
  });
  it("leaves out constant and aliased columns with a warning (R's deviance)", () => {
    for (const [key, formula, extra] of [["collinear", "y ~ x1 + x2 + x3", { x3: d.x1.map((v: number) => 2 * v - 1) }],
      ["constant", "y ~ x1 + k", { k: d.x1.map(() => 5) }]] as const) {
      const f = multinom(formula, { ...d, ...extra });
      expect(rel(f.deviance, edge[key].value.deviance)).toBeLessThan(1e-12);
      expect(f.coefficients.every((row) => Number.isNaN(row[row.length - 1]!))).toBe(true);
      expect(f.warnings[0]).toMatch(/^design appears to be rank-deficient, so dropping some coefs: (x3|k)$/);
    }
  });
  it("fits a level with two cases and a response with ten levels as R", () => {
    const y = d.y.slice(); y[4] = "D"; y[8] = "D";
    const f = multinom("y ~ x1 + x2", { ...d, y });
    rows(edge.rareLevel.value.coef, 3, 3).forEach((row, k) => row.forEach((v, j) => expect(rel(f.coefficients[k]![j]!, v)).toBeLessThan(1e-5)));
    const m = multinom("y ~ z", { y: edge.many.y, z: edge.many.z });
    rows(edge.many.fit.value.coef, 9, 2).forEach((row, k) => row.forEach((v, j) => expect(rel(m.coefficients[k]![j]!, v)).toBeLessThan(1e-6)));
    expect(rel(m.deviance, edge.many.fit.value.deviance)).toBeLessThan(1e-12);
  });
  it("fits 20000 rows quickly, with R's answer", () => {
    const t0 = performance.now();
    const f = multinom("y ~ u1 + u2", { y: edge.big.y, u1: edge.big.u1, u2: edge.big.u2 });
    expect((performance.now() - t0) / 1000).toBeLessThan(5);
    expect(rel(f.deviance, edge.big.fit.deviance)).toBeLessThan(1e-12);
    rows(edge.big.fit.coef, 2, 3).forEach((row, k) => row.forEach((v, j) => expect(rel(f.coefficients[k]![j]!, v)).toBeLessThan(1e-6)));
  });
});

describe("multinom: separated data", () => {
  it("reports that the maximum does not exist", () => {
    const f = multinom("y ~ x1", edge.separated.data);
    expect(f.converged).toBe(false);
    expect(f.warnings).toEqual(["fitted probabilities numerically 0 or 1 occurred: the maximum of the likelihood does not exist (separated data)"]);
  });
});
