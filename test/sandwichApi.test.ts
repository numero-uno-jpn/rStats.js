// vcovHC and vcovCL beyond the fixtures: formula fits, rows dropped or of weight 0, omega, multi-way clusters as
// tuples, fix, and the checks of the arguments (oracle/robust-behaviour.md, "rStats.js's choices").
import { describe, expect, it } from "vitest";
import { eigen, glm, lm, vcovCL, vcovHC } from "../src/index.js";
import { matrixError } from "./helpers/robust.js";

const x = [1.2, 2.3, 2.9, 4.1, 5.5, 6.2, 7.4, 8.1, 9.3, 10.2];
const y = [2.1, 3.8, 4.2, 6.9, 8.1, 9.9, 10.2, 13.5, 13.1, 16.8];
const g = ["a", "a", "b", "b", "b", "c", "c", "d", "d", "d"];

describe("vcovHC and vcovCL", () => {
  it("take formula fits, with the rows the fit dropped dropped from the cluster", () => {
    const data = { y: [...y, NaN], x: [...x, 3] };
    const f = lm("y ~ x", data);
    const m = lm(x, y);
    expect(vcovHC(f).names).toEqual(["(Intercept)", "x"]);
    expect(matrixError(vcovHC(f).vcov, vcovHC(m).vcov)).toBeLessThan(1e-14);
    // one label per input row (the dropped row 11 included)
    expect(matrixError(vcovCL(f, { cluster: [...g, "e"] }).vcov, vcovCL(m, { cluster: g }).vcov)).toBeLessThan(1e-14);
    expect(() => vcovCL(f, { cluster: g })).toThrow("number of observations in 'cluster' and 'estfun()' do not match");
    // the matrix interface likewise (the label of the dropped row is not looked at)
    const mNA = lm([...x, 3], [...y, NaN]);
    expect(mNA.rows).toEqual(x.map((_, i) => i));
    expect(matrixError(vcovCL(mNA, { cluster: [...g, null] }).vcov, vcovCL(m, { cluster: g }).vcov)).toBe(0);
  });

  it("leave rows of weight 0 out", () => {
    const w = x.map((_, i) => (i === 4 ? 0 : 1 + (i % 3)));
    const fit = lm(x, y, { weights: w });
    const keep = w.map((v) => v > 0);
    const sub = lm(
      x.filter((_, i) => keep[i]),
      y.filter((_, i) => keep[i]),
      { weights: w.filter((_, i) => keep[i]) },
    );
    for (const type of ["HC0", "HC3", "HC5"] as const) expect(matrixError(vcovHC(fit, { type }).vcov, vcovHC(sub, { type }).vcov)).toBeLessThan(1e-13);
    // omega: one value per row of non-zero weight, or per row used
    const om = sub.residuals.map((r) => r * r);
    expect(vcovHC(fit, { omega: om }).vcov).toEqual(vcovHC(fit, { omega: [...om.slice(0, 4), 123, ...om.slice(4)] }).vcov);
    // a cluster whose rows all have weight 0 is not counted
    const gz = g.map((v, i) => (i === 4 ? "z" : v));
    expect(matrixError(vcovCL(fit, { cluster: gz }).vcov, vcovCL(sub, { cluster: gz.filter((_, i) => keep[i]) }).vcov)).toBeLessThan(1e-13);
  });

  it("call omega with the residual factors, the hat values and n - k", () => {
    const fit = lm(x, y);
    let seen: [number[], number[], number] | undefined;
    const V = vcovHC(fit, {
      omega: (res, h, df) => {
        seen = [res, h, df];
        return res.map((r, i) => r ** 2 / (1 - h[i]!));
      },
    }).vcov;
    expect(matrixError(V, vcovHC(fit, { type: "HC2" }).vcov)).toBeLessThan(1e-15);
    expect(seen![2]).toBe(8);
    expect(seen![0]).toEqual(fit.residuals);
    expect(() => vcovHC(fit, { omega: [1, 2] })).toThrow("'omega' must have one value per observation (10)");
    expect(() => vcovHC(fit, { omega: () => x.map(() => NaN) })).toThrow("'omega' must be finite");
  });

  it("form multi-way intersections as tuples and fix negative eigenvalues", () => {
    const fit = lm(x, y);
    const t = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    const two = vcovCL(fit, { cluster: [g, t] }).vcov;
    const V1 = vcovCL(fit, { cluster: g }).vcov;
    const V2 = vcovCL(fit, { cluster: t }).vcov;
    const V12 = vcovCL(fit, { cluster: g.map((v, i) => `${v}/${t[i]}`) }).vcov;
    expect(matrixError(two, V1.map((r, i) => r.map((v, j) => v + V2[i]![j]! - V12[i]![j]!)))).toBeLessThan(1e-14);
    const fixed = vcovCL(fit, { cluster: [g, t], fix: true }).vcov;
    const { values } = eigen(fixed, { symmetric: true });
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1e-15 * Math.max(...values));
    // numbers, strings and booleans; a number and its text are one cluster
    const codes = g.map((v) => v.charCodeAt(0));
    expect(vcovCL(fit, { cluster: codes }).vcov).toEqual(vcovCL(fit, { cluster: codes.map(String) }).vcov);
    expect(vcovCL(fit, { cluster: t.map((v) => v === 1) }).vcov).toEqual(vcovCL(fit, { cluster: t }).vcov);
  });

  it("give HC0 for a glm and HC1 for an lm by default", () => {
    const counts = [2, 3, 3, 5, 6, 8, 9, 12, 13, 18];
    const fit = glm(x, counts, { family: "poisson" });
    expect(vcovCL(fit, { cluster: g }).vcov).toEqual(vcovCL(fit, { cluster: g, type: "HC0" }).vcov);
    expect(vcovCL(lm(x, y), { cluster: g }).vcov).toEqual(vcovCL(lm(x, y), { cluster: g, type: "HC1" }).vcov);
  });

  it("check their arguments", () => {
    const fit = lm(x, y);
    expect(() => vcovCL(fit, { cluster: x.map(() => "a") })).toThrow("at least two clusters are needed");
    expect(() => vcovCL(fit, { cluster: g.map((v, i) => (i === 2 ? NaN : v)) })).toThrow("cannot handle NAs in 'cluster'");
    expect(() => vcovCL(fit, { cluster: g.map(() => ({})) as never })).toThrow(TypeError);
    expect(() => vcovHC(fit, { type: "HC6" as never })).toThrow("'arg' should be one of");
    // R's match.arg: an unambiguous abbreviation
    expect(vcovHC(fit, { type: "co" as never }).vcov).toEqual(vcovHC(fit, { type: "const" }).vcov);
    expect(() => vcovHC(fit, { typ: "HC0" } as never)).toThrow(RangeError);
    expect(() => vcovCL(fit, { cluster: g, cadjust: 1 as never })).toThrow("'cadjust' must be true or false");
    expect(() => vcovHC({} as never)).toThrow("'fit' must be the result of lm or glm");
  });
});
