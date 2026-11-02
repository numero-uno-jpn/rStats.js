// Issue #143: the interval of cohensD and hedgesG searched the noncentrality from [t - 1, t + 1], which is empty where
// t ± 1 both round to t (t = 2^54 for [1, 1 + eps] with mu = -1): uniroot threw "lower < upper is not fulfilled".
// The step is now 1 to 2 ulp of t there (review_fix_log_issue143.md).
import { describe, expect, it } from "vitest";
import { cohensD, hedgesG, pt } from "../src/index.js";

const E = Number.EPSILON;

describe("issue #143", () => {
  it("finds the limits where t ± 1 rounds to t", () => {
    const r = cohensD([1, 1 + E], undefined, { mu: -1 });
    const t = 2 ** 54;
    const scale = Math.SQRT1_2; // d = t sqrt(1/n)
    expect(Math.abs(r.value / (t * scale) - 1)).toBeLessThan(1e-15);
    // the limits are the noncentralities with P[T <= t] = 0.975 and 0.025 (df 1)
    expect(Math.abs(pt(t, 1, { ncp: r.ciLow! / scale }) - 0.975)).toBeLessThan(1e-14);
    expect(Math.abs(pt(t, 1, { ncp: r.ciHigh! / scale }) - 0.025)).toBeLessThan(1e-14);
    expect(r.ciLow!).toBeLessThan(r.value);
    expect(r.ciHigh!).toBeGreaterThan(r.value);
    expect(() => hedgesG([1, 1 + E], undefined, { mu: -1 })).not.toThrow();
  });

  it("keeps the step of 1 elsewhere", () => {
    // values of the implementation before the fix
    const r = cohensD([1, 1 + E, 1 + 2 * E], undefined, { mu: -1 });
    expect([r.value, r.ciLow, r.ciHigh]).toEqual([9007199254740992, 1433186871003179, 17299637460575152]);
    const s = cohensD([1, 1 + 1e-10], undefined, { mu: -1 });
    expect([s.ciLow, s.ciHigh]).toEqual([886371910.5255351, 63396437478.51937]);
  });
});
