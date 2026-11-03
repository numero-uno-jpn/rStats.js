// Issue #480: the inverse Gaussian deviance contribution where (y - mu)/mu or its square overflows although
// w (y - mu)² / (y mu²) is finite (review_fix_log_issue480.md).
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

const dev = makeFamily("inverse.gaussian").devContribution;
const ulps = (v: number, ref: number): number => Math.abs(v - ref) / (ref * 2 ** -52);

describe("issue #480", () => {
  it("gives the finite contribution", () => {
    // Rmpfr with the doubles 1e200, 1e-200, 1e-300: 0x1.7e43c8800759cp+996 (R 4.5.2 Inf; was Inf)
    expect(ulps(dev(1e200, 1e-200, 1e-300), 0x17e43c8800759c * 2 ** 944)).toBeLessThanOrEqual(2);
    // d = 1e250 finite, d² overflows: Rmpfr 0.99999999999999997956 (R Inf; was Inf)
    expect(ulps(dev(1e200, 1e-50, 1e-300), 1)).toBeLessThanOrEqual(2);
  });

  it("keeps the earlier values", () => {
    // values before the fix (#164's fallback and the direct form)
    expect(dev(1e-308, 1e308, 1)).toBe(1e308);
    expect(dev(2, 3, 0.5)).toBe(2001599834386887 * 2 ** -56);
  });
});
