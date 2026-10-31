// Fixes of the 14th review round (review_fix_log_20261031_14.md): scale-free type I/II hypotheses of lmerTest's
// anova, comparisons of fits of the same observations, confidence levels, qr's tolerance, norms and BY's sum.
import { describe, expect, it } from "vitest";
import { lmer, lmerAnova } from "../src/entries/mixed.js";
import { anova, cohensD, confint, glm, glmAnova, lm, pAdjust, predict, qr } from "../src/index.js";
import { norm2 } from "../src/internal/summary.js";

describe("lmerAnova type I and II do not depend on the units of the predictors", () => {
  // R 4.5.2 + lmerTest: with x2 scaled by 1e-6, the type I F of x1 turned into its type II F (a bug in lmerTest)
  const n = 48;
  const g = Array.from({ length: n }, (_, i) => `g${Math.floor(i / 6)}`);
  const x1 = Array.from({ length: n }, (_, i) => Math.sin(i * 1.3) + 0.2 * Math.cos(i * 0.7));
  const x2 = Array.from({ length: n }, (_, i) => Math.cos(i * 0.9) + 0.5 * x1[i]!);
  const u = Array.from({ length: 8 }, (_, j) => Math.sin(j * 2.1));
  const y = x1.map((v, i) => 1 + 0.5 * v + 0.3 * x2[i]! + u[Math.floor(i / 6)]! + 0.6 * Math.sin(i * 3.7));
  const F = (s: number, type: 1 | 2): number[] => {
    const t = lmerAnova(lmer("y ~ x1 + x2s + (1 | g)", { g, x1, x2s: x2.map((v) => v * s), y }), { type });
    return t.F;
  };
  it("type I", () => {
    const ref = F(1, 1);
    for (const s of [1e-6, 1e-10, 1e6]) F(s, 1).forEach((v, i) => expect(v).toBeCloseTo(ref[i]!, 6));
    expect(Math.abs(ref[0]! - F(1, 2)[0]!)).toBeGreaterThan(1e-3); // type I and II differ here
  });
  it("type II", () => {
    const ref = F(1, 2);
    for (const s of [1e-6, 1e6]) F(s, 2).forEach((v, i) => expect(v).toBeCloseTo(ref[i]!, 6));
  });
});

describe("comparisons of fits of the same observations", () => {
  const d = { y: [2, 4, 6.5, 8, 10.5, 11, 15], x: [1, 2, 3, 4, 5, 6, 7], z: [0.3, -1, 0.2, 0.8, -0.4, 0.1, 0.9] };
  it("anova of lm fits of different rows or response values", () => {
    const a = { ...d, y: [NaN, ...d.y.slice(1)] };
    const b = { ...d, y: [...d.y.slice(0, 6), NaN] };
    expect(() => anova(lm("y ~ x", a), lm("y ~ x + z", b))).toThrow("same rows");
    expect(() => anova(lm("y ~ x", d), lm("y ~ x + z", { ...d, y: d.y.map((v) => v + 1) }))).toThrow("same response values");
    expect(anova(lm("y ~ x", d), lm("y ~ x + z", d)).table).toHaveLength(2);
  });
  it("glmAnova of fits of different responses", () => {
    const X = d.x.map((v, i) => [v, d.z[i]!]);
    expect(() => glmAnova([glm(d.x, d.y), glm(X, d.y.map((v) => v * 2))])).toThrow("same response");
  });
});

describe("input checks", () => {
  const fit = lm("y ~ x", { y: [1, 3, 2, 5, 4], x: [1, 2, 3, 4, 5] });
  it("confidence levels", () => {
    expect(() => confint(fit, { level: 1.5 })).toThrow("'level' must be between 0 and 1");
    expect(() => predict(fit, [3], { interval: "confidence", level: -0.2 })).toThrow("'level' must be between 0 and 1");
    expect(() => cohensD([1, 2, 3, 4], [2, 4, 5, 7], { ci: 1.5 })).toThrow("between (0, 1)");
  });
  it("qr's tolerance", () => {
    expect(() => qr([[1, 2], [2, 4], [3, 6]], { tol: -1 })).toThrow("non-negative");
    expect((qr([[1, 2], [2, 4], [3, 6]]) as { rank: number }).rank).toBe(1);
  });
});

describe("norm2 and BY's harmonic sum", () => {
  it("norm2 does not overflow", () => {
    expect(norm2([1e200, 1e200])).toBeCloseTo(Math.SQRT2 * 1e200, -186);
    expect(norm2([3e-200, 4e-200]) / 5e-200).toBeCloseTo(1, 14);
    expect(norm2([3, 4])).toBe(5);
  });
  it("BY with a large n", () => {
    let h = 0;
    for (let k = 1; k <= 50; k++) h += 1 / k;
    expect(pAdjust([0.0001], { method: "BY", n: 50 })[0]).toBeCloseTo(0.0001 * 50 * h, 15);
    expect(pAdjust([1e-12], { method: "BY", n: 1e7 })[0]).toBeGreaterThan(0);
  });
});
