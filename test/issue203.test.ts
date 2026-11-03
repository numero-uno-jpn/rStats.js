// Issue #203: TukeyHSD rejects a confidence level outside [0, 1] (review_fix_log_issue203.md).
import { describe, expect, it } from "vitest";
import { TukeyHSD } from "../src/index.js";

const x = [
  [1, 2, 3],
  [2, 3, 4],
];

describe("issue #203", () => {
  it("throws a RangeError for confLevel outside [0, 1] or not a number", () => {
    // R 4.5.2 returns NaN limits for these (with a warning "NaNs produced" for 1.2 and -0.1)
    for (const confLevel of [1.2, -0.1, NaN, Infinity, -Infinity]) {
      expect(() => TukeyHSD(x, { confLevel })).toThrow(RangeError);
    }
  });

  it("keeps the limits of R at 0, 1 and the default", () => {
    // R 4.5.2: TukeyHSD(aov(y ~ g), conf.level = 0 / 1): lwr = upr = diff = 1; lwr = -Inf, upr = Inf; p adj 0.2878644
    const at0 = TukeyHSD(x, { confLevel: 0 });
    expect([at0.lwr[0], at0.upr[0], at0.diff[0]]).toEqual([1, 1, 1]);
    const at1 = TukeyHSD(x, { confLevel: 1 });
    expect([at1.lwr[0], at1.upr[0]]).toEqual([-Infinity, Infinity]);
    expect(at1.pAdj[0]).toBe(0.28786413472669065);
    const def = TukeyHSD(x);
    expect(def).toEqual(TukeyHSD(x, { confLevel: 0.95 }));
    expect(Number.isFinite(def.lwr[0]) && Number.isFinite(def.upr[0])).toBe(true);
  });
});
