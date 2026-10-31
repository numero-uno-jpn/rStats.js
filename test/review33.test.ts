// Fixes of the 33rd review round (review_fix_log_20261031_33.md): the power and effect-size functions reject NaN and
// out-of-range inputs, say why a quantity cannot be solved for, take the limit 1 for an overflowing noncentrality, and
// cohensD rejects infinite values and too few observations.
import { describe, expect, it } from "vitest";
import { cohensD, esH, esW1, esW2, powerAnovaTest, powerPropTest, powerTTest, pwrAnovaTest, pwrChisqTest, pwrF2Test, pwrRTest, pwrT2nTest, pwrTTest } from "../src/index.js";

describe("review 33", () => {
  it("A: NaN and values outside the range are errors", () => {
    // R: power.prop.test(n = 0) is 0.021, n = -1 NaN
    expect(() => powerPropTest({ n: 0, p1: 0.5, p2: 0.75 })).toThrow("number of observations in each group must be positive");
    expect(() => powerPropTest({ n: -1, p1: 0.5, p2: 0.75 })).toThrow("must be positive");
    expect(powerPropTest({ n: Infinity, p1: 0.5, p2: 0.75 }).power).toBe(1); // as R
    expect(() => powerTTest({ n: 30, delta: NaN })).toThrow("'delta' must not be NaN");
    expect(() => powerAnovaTest({ groups: NaN, n: 10, betweenVar: 1, withinVar: 3 })).toThrow("number of groups must be at least 2");
    // pwr stops with "missing value where TRUE/FALSE needed"; NaN was returned
    expect(() => pwrAnovaTest({ k: 3, n: 10, f: NaN })).toThrow("the effect size must not be NaN");
    expect(() => pwrTTest({ n: 10, d: NaN })).toThrow("the effect size must not be NaN");
    expect(() => pwrT2nTest({ n1: NaN, n2: 10, d: 0.5 })).toThrow("number of observations in the first group must be at least 2");
    expect(() => pwrTTest({ n: 1, d: 0.5 })).toThrow("number of observations in each group must be at least 2"); // as pwr
    expect(() => pwrRTest({ n: 30, r: 1.5 })).toThrow("'r' must be in [-1, 1]"); // R: NaN
    expect(() => esH(1.2, 0.5)).toThrow("p1 and p2 must be probabilities in [0, 1]"); // R: NaN
    expect(() => esW2([])).toThrow("'P' must be a non-empty matrix"); // R: 0
    expect(() => esW2([[0.5, 0.5], [0.5]])).toThrow("'P' must be a non-empty matrix");
    expect(() => esW1([0.5, 1.5], [0.5, 0.5])).toThrow("'P0' and 'P1' must be probabilities in [0, 1]");
    // unchanged
    expect(pwrT2nTest({ n1: Infinity, n2: 10, d: 0.5 }).power).toBeCloseTo(0.3526080824, 9); // R 4.5.2
    expect(pwrRTest({ n: 30, power: 0.05 }).r).toBeCloseTo(0.01268918236, 9); // R 4.5.2
  });
  it("B: quantities that the power does not depend on, and a negative delta", () => {
    // R: "lower < upper  is not fulfilled"
    expect(() => powerTTest({ n: 30, delta: 0, sd: null, power: 0.05 })).toThrow("'sd' cannot be determined when 'delta' is 0");
    expect(() => powerAnovaTest({ groups: 3, n: 10, betweenVar: 0, withinVar: null, power: 0.05 })).toThrow(
      "'withinVar' cannot be determined when 'betweenVar' is 0",
    );
    // one-sided with a negative delta: the power rises to sigLevel as sd grows (the interval was reversed)
    const sd = powerTTest({ n: 30, delta: -0.5, sd: null, power: 0.01, type: "one.sample", alternative: "one.sided" }).sd;
    expect(powerTTest({ n: 30, delta: -0.5, sd, type: "one.sample", alternative: "one.sided" }).power).toBeCloseTo(0.01, 5); // within the root tolerance
  });
  it("C: cohensD with an infinite value or too few observations", () => {
    // effectsize: NA; it ended in the root search ("lower < upper is not fulfilled")
    expect(() => cohensD([1, 2, Infinity], [2, 3, 4])).toThrow("the observations must be finite (NaN is dropped as missing)");
    expect(() => cohensD([10])).toThrow("not enough observations: at least 2 are needed");
    expect(() => cohensD([1, NaN], [3, 4])).toThrow("at least 2 are needed in each group");
    expect(() => cohensD([1, 2], [3, NaN], { paired: true })).toThrow("not enough complete pairs");
    // a constant sample: as effectsize (Inf, NaN)
    expect(cohensD([5, 5], [3, 3], { ci: null }).value).toBe(Infinity);
    expect(cohensD([5, 5], [5, 5], { ci: null }).value).toBeNaN();
  });
  it("D: a noncentrality beyond the doubles gives the limit 1", () => {
    // R: NaN
    expect(pwrChisqTest({ w: 1e200, N: 100, df: 3 }).power).toBe(1);
    expect(pwrF2Test({ u: 3, v: 60, f2: 1e308 }).power).toBe(1);
    expect(pwrAnovaTest({ k: 3, n: 10, f: 1e200 }).power).toBe(1);
    // a ratio in range whose product overflowed
    expect(powerAnovaTest({ groups: 3, n: 10, betweenVar: 1e308, withinVar: 1e308 }).power).toBe(
      powerAnovaTest({ groups: 3, n: 10, betweenVar: 1, withinVar: 1 }).power,
    );
  });
  it("E: cells with both probabilities 0 add nothing", () => {
    // R: NaN
    expect(esW1([0.5, 0.5, 0], [0.5, 0.5, 0])).toBe(0);
    expect(esW1([0.5, 0.5, 0], [0.4, 0.4, 0.2])).toBe(Infinity); // as R
    expect(esW2([[0.3, 0.2], [0, 0], [0.1, 0.4]])).toBe(esW2([[0.3, 0.2], [0.1, 0.4]]));
    expect(esW1([0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2])).toBe(0.34641016151377546); // unchanged
  });
});
