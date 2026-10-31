// Fixes of the 16th review round (review_fix_log_20261031_16.md).
import { describe, expect, it } from "vitest";
import { pnbeta1 } from "../src/distributions/nbeta.js";
import { lmer, lmerAnova } from "../src/entries/mixed.js";
import { coxph } from "../src/index.js";

describe("review 16", () => {
  it("coxph: an event at Infinity is an error, a censoring at Infinity is not", () => {
    const t = [5, 8, 12, 3, 9, 15, 7, Infinity];
    const x = [0.5, 1.2, -0.3, 2.1, 0.8, -1.1, 0.4, 1.6].map((v) => [v]);
    expect(() => coxph(t, [1, 1, 0, 1, 1, 1, 0, 1], x)).toThrow("event times must be finite");
    expect(Number.isFinite(coxph(t, [1, 1, 0, 1, 1, 1, 0, 0], x).coefficients[0])).toBe(true);
  });
  it("pnbeta checks the parameters before the ends of the support", () => {
    expect(pnbeta1(0, -1, 2, 0.5, true, false)).toBeNaN();
    expect(pnbeta1(1, 2, 2, Infinity, true, false)).toBeNaN();
    expect(pnbeta1(0, 2, 2, 0.5, true, false)).toBe(0);
  });
  it("lmerAnova gives no likelihood ratio test for fits that are not nested", () => {
    const n = 40;
    const g = Array.from({ length: n }, (_, i) => `g${i % 8}`);
    const x1 = Array.from({ length: n }, (_, i) => Math.sin(i * 1.1));
    const x2 = Array.from({ length: n }, (_, i) => Math.cos(i * 0.7));
    const x3 = Array.from({ length: n }, (_, i) => Math.sin(i * 0.3 + 1));
    const y = x1.map((v, i) => 1 + v + 0.5 * x2[i]! + Math.sin((i % 8) * 2.3) + 0.4 * Math.cos(i * 3.1));
    const d = { g, x1, x2, x3, y };
    const opt = { REML: false };
    const a = lmer("y ~ x1 + (1 | g)", d, opt);
    const b = lmer("y ~ x2 + x3 + (1 | g)", d, opt);
    const c = lmer("y ~ x1 + x2 + (1 | g)", d, opt);
    const t1 = lmerAnova([a, b]);
    expect(t1.Chisq[1]).toBeNaN();
    expect(t1.pValue[1]).toBeNaN();
    const t2 = lmerAnova([a, c]);
    expect(t2.pValue[1]).toBeGreaterThan(0);
  });
});
