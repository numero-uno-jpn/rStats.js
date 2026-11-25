import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { betareg, betaregPredict, tobit, loglin, loglm } from "../src/entries/regression.js";

// The first pass over the edge cases (experiments/regression117-edge.R, x86_64 R): R's values where R fits, and
// exact scale equivariance where R fails (log 27-29)
const R = JSON.parse(readFileSync(new URL("../experiments/regression117-edge.json", import.meta.url), "utf8")) as Record<string, any>;
const d = JSON.parse(readFileSync(new URL("./fixtures/betareg.json", import.meta.url), "utf8")).data.d as Record<string, number[]>;
const coef = (r: ReturnType<typeof betareg>) => [...r.coefficients.mean, ...r.coefficients.precision];
const near = (a: number[], b: number[], tol: number) => a.forEach((v, j) => expect(Math.abs(v - b[j]!), `${j}: ${v} ${b[j]}`).toBeLessThanOrEqual(tol * Math.max(1e-300, Math.abs(b[j]!))));

describe("betareg on edge cases", () => {
  const base = coef(betareg("yc ~ x1 + x2", d));
  it("is scale equivariant in a covariate (R fails from 1e150) and keeps a common value of 1e8 (R fails)", () => {
    for (const s of [1e150, 1e-150, 1e300, 1e-300]) near(coef(betareg("yc ~ x1 + x2", { ...d, x1: d.x1!.map((v) => v * s) })), [base[0]!, base[1]! / s, base[2]!, base[3]!], 1e-12);
    near(coef(betareg("yc ~ x1 + x2", { ...d, x1: d.x1!.map((v) => v * 1e-150) })), R["x*1e-150"].value, 1e-6);
    const shifted = coef(betareg("yc ~ x1 + x2", { ...d, x1: d.x1!.map((v) => v + 1e8) }));
    near(shifted.slice(1), base.slice(1), 1e-8);
    expect(R["x+1e+08"].error).toBeDefined();
  });
  it("gives R's fits with weights near 1e+-200 and responses near 0 and 1", () => {
    for (const s of [1, 1e200, 1e-200]) near(coef(betareg("yc ~ x1 + x2", { ...d, w: d.w!.map((v) => v * s) }, { weights: "w" })), R[`w*${s === 1 ? 1 : s}`].value, 1e-6);
    near(coef(betareg("yc ~ x1 + x2", { ...d, yc: d.yc!.map((v, i) => (i < 5 ? 1e-12 : v)) })), R.y_tiny.value, 1e-6);
    near(coef(betareg("yc ~ x1 + x2", { ...d, yc: d.yc!.map((v, i) => (i < 5 ? 1 - 1e-12 : v)) })), R.y_near1.value, 1e-6);
    near(coef(betareg("yc ~ x1", { yc: [0.2, 0.5, 0.4], x1: [1, 2, 3] })), R.n3.value, 1e-6);
  });
  it("errors where the model cannot be fitted", () => {
    expect(() => betareg("yc ~ x1", { yc: [0.2, 0.5], x1: [1, 2] })).toThrow(/fewer observations/);
    expect(() => betareg("yc ~ x1 + x3", { ...d, x3: d.x1!.map((v) => 2 * v) })).toThrow();
    expect(() => betareg("yc ~ x1", { yc: d.yc!.map(() => 0.3), x1: d.x1! })).toThrow();
  });
  it("fits 100000 rows (R: 58 s) and BR on 20000", () => {
    const N = 100000, xs = Array.from({ length: N }, (_, i) => Math.sin(i) * 2);
    const ys = xs.map((x, i) => (1 / (1 + Math.exp(-(0.3 + 0.5 * x)))) * 0.9 + (0.05 * ((i * 7919) % 1000)) / 1000);
    near(coef(betareg("y ~ x", { y: ys, x: xs })), R.n1e5_ML.value, 1e-6);
    near(coef(betareg("y ~ x", { y: ys.slice(0, 20000), x: xs.slice(0, 20000) }, { type: "BR" })), R.n2e4_BR.value, 1e-6);
  }, 60000);
});

describe("tobit and loglin on edge cases", () => {
  it("tobit gives R's fit for a response near 1e-150 and is scale equivariant", () => {
    const y = d.yc!.map((v) => (v - 0.3) * 1e-150);
    const r = tobit("y ~ x1", { y, x1: d.x1! });
    // R's own fit there is 2e-7 from its unscaled fit times 1e-150 (its convergence); rStats.js's is exact
    near([...r.coefficients, r.scale[0]!], R["tobit*1e-150"].value, 1e-6);
    const b = tobit("y ~ x1", { y: d.yc!.map((v) => v - 0.3), x1: d.x1! });
    const exact = r.counts.uncensored;
    expect(Math.abs(r.loglik[1] - (b.loglik[1] - exact * Math.log(1e-150)))).toBeLessThan(1e-9 * Math.abs(b.loglik[1]) + 1e-6);
  });
  it("loglin converges in one cycle for counts near 1e-300 (as R) and keeps its statistics for counts near 1e300 (R's are NaN)", () => {
    const counts = [32, 11, 10, 3, 53, 50, 25, 15, 10, 10, 7, 7, 3, 30, 5, 8], m = [[1, 2], [1, 3], [2, 3]];
    const base = loglin({ counts, dim: [2, 2, 4] }, m);
    const tiny = loglin({ counts: counts.map((v) => v * 1e-300), dim: [2, 2, 4] }, m);
    expect(tiny.iterations).toBe(1);
    const big = loglin({ counts: counts.map((v) => v * 1e300), dim: [2, 2, 4] }, m);
    expect(Number.isFinite(big.pearson) && Number.isFinite(big.lrt)).toBe(true);
    expect(R.loglin_1e300.value.lrt).toBeNull();
    const zero = loglin({ counts: counts.map((v, i) => (i % 4 === 0 ? 0 : v)), dim: [2, 2, 4] }, m);
    expect(zero.lrt).toBeCloseTo(R.loglin_zero.value.lrt, 12);
    expect(zero.pearson).toBeNaN(); // a sampling zero fitted as 0, as R
    expect(base.iterations).toBe(4);
  });
});

// The second pass (experiments/regression117-edge2.R)
describe("the second pass over the edge cases", () => {
  const R2 = JSON.parse(readFileSync(new URL("../experiments/regression117-edge2.json", import.meta.url), "utf8")) as Record<string, any>;
  const fx = JSON.parse(readFileSync(new URL("./fixtures/betareg.json", import.meta.url), "utf8")).data.d as Record<string, (number | string | null)[]>;
  it("betareg drops rows missing in the precision model only, and leaves zero weights out of a modelled-precision fit", () => {
    const z1na = (fx.z1 as number[]).map((v, i) => (i === 2 || i === 6 ? null : v));
    const f = betareg("yv ~ x1 + x2 | z1na", { ...fx, z1na } as never);
    near(coef(f), R2.beta_z_na.coef, 1e-6);
    expect(f.nobs).toBe(R2.beta_z_na.nobs);
    const w0 = (fx.w as number[]).map((v, i) => (i === 1 || i === 4 ? 0 : v));
    const g = betareg("yv ~ x1 + x2 | z1", { ...fx, w0 } as never, { weights: "w0" });
    near(coef(g), R2.beta_var_w0.coef, 1e-6);
    expect(g.loglik).toBeCloseTo(R2.beta_var_w0.loglik, 8);
  });
  it("betareg's predictions refuse a new factor level", () => {
    const f = betareg("yv ~ x1 + g", fx as never);
    expect(() => betaregPredict(f, { newdata: { x1: [0], g: ["zz"] } })).toThrow();
  });
  it("tobit refuses a zero weight and fits a level whose responses are all censored as R", () => {
    const td = R2.data_td;
    expect(() => tobit("y ~ x1", td, { weights: "w0" })).toThrow(R2.tobit_w0.error);
    const f = tobit("y ~ x1 + g", td);
    near(f.coefficients, R2.tobit_level_all_censored.coef, 1e-5);
    near(f.loglik, R2.tobit_level_all_censored.loglik, 1e-8);
  });
  it("loglm takes numbers for the dimensions of an unnamed table", () => {
    const r = loglm("~ 1 * 2 + 3", { counts: [32, 11, 10, 3, 53, 50, 25, 15, 10, 10, 7, 7, 3, 30, 5, 8], dim: [2, 2, 4] });
    expect(r.lrt).toBeCloseTo(R2.loglm_numbers.lrt, 10);
    expect(r.df).toBe(R2.loglm_numbers.df);
  });
});
