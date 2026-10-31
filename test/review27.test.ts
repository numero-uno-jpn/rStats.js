// Fixes of the 27th review round (review_fix_log_20261031_27.md): lm with weights whose sums overflow; lmerContest's
// level, infinite contrasts and infinite rhs.
import { describe, expect, it } from "vitest";
import { lm } from "../src/index.js";
import { lmer, lmerContest } from "../src/entries/mixed.js";

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const x = [1, 2, 3, 4, 5, 6];
const y = [1.2, 1.9, 3.4, 3.8, 5.3, 5.9];

describe("review 27", () => {
  it("lm: R^2, F and the standard errors do not depend on the scale of the weights; sigma grows as its square root", () => {
    const ref = lm(x, y, { weights: x.map(() => 1) });
    for (const c of [1e-300, 1e300, 1e308]) {
      const r = lm(x, y, { weights: x.map(() => c) });
      // R 4.5.2 at 1e308: R^2 NaN, F NaN
      expect(rel(r.rSquared, ref.rSquared)).toBeLessThan(1e-14);
      expect(rel(r.fStatistic!.value, ref.fStatistic!.value)).toBeLessThan(1e-12);
      expect(rel(r.coefTable.stdError[1]!, ref.coefTable.stdError[1]!)).toBeLessThan(1e-12);
      expect(rel(r.sigma, ref.sigma * Math.sqrt(c))).toBeLessThan(1e-14);
    }
  });
  it("lm through the formula interface with weights near 1e308 (sigma was NaN)", () => {
    const ref = lm("y ~ x", { x, y, w: x.map(() => 1) }, { weights: "w" });
    const r = lm("y ~ x", { x, y, w: x.map(() => 1e308) }, { weights: "w" });
    expect(rel(r.rSquared, ref.rSquared)).toBeLessThan(1e-14);
    expect(rel(r.fStatistic!.value, ref.fStatistic!.value)).toBeLessThan(1e-12);
    expect(rel(r.sigma, ref.sigma * 1e154)).toBeLessThan(1e-14);
  });
  it("lmerContest: level strictly between 0 and 1, no infinite contrast or rhs", () => {
    const d = { y: [1.1, 2.3, 2.9, 4.2, 5.1, 5.8, 7.2, 8.1], x: [1, 2, 3, 4, 5, 6, 7, 8], g: ["a", "a", "b", "b", "c", "c", "d", "d"] };
    const fit = lmer("y ~ x + (1 | g)", d);
    // lmerTest: "level < 1 is not TRUE", "level > 0 is not TRUE"
    expect(() => lmerContest(fit, [0, 1], { joint: false, level: 1 })).toThrow("level must be a number between 0 and 1");
    expect(() => lmerContest(fit, [0, 1], { joint: false, level: 0 })).toThrow("level must be a number between 0 and 1");
    // an empty table was returned silently
    expect(() => lmerContest(fit, [0, Infinity])).toThrow("L must not contain infinite values");
    expect(() => lmerContest(fit, [[0, -Infinity]], { joint: false })).toThrow("L must not contain infinite values");
    // F and the sum of squares were NaN, p 0
    expect(() => lmerContest(fit, [0, 1], { rhs: Infinity })).toThrow("rhs must not contain infinite values");
    expect(lmerContest(fit, [0, 1], { joint: false, level: 0.9 }).estimate[0]).toBeCloseTo(0.9894865131870085, 12);
  });
});
