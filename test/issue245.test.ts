// Issue #245: distSummary("gamma") with both rate and scale took the scale and ignored the rate, where dgamma and the
// other gamma functions throw unless scale = 1 / rate. The parameters now go through the same gammaScale(), and an
// inconsistent pair gives NaN throughout, distSummary's convention for invalid parameters
// (review_fix_log_issue245.md).
import { describe, expect, it } from "vitest";
import { dgamma, distSummary } from "../src/index.js";

describe("issue #245", () => {
  it("rejects a rate and scale that disagree, as dgamma", () => {
    expect(() => dgamma(1, 2, { rate: 2, scale: 1 })).toThrow(RangeError);
    const s = distSummary("gamma", { shape: 2, rate: 2, scale: 1 });
    for (const v of Object.values(s)) expect(v).toBeNaN();
    for (const v of Object.values(distSummary("gamma", { shape: 2, rate: NaN, scale: 1 }))) expect(v).toBeNaN();
  });

  it("keeps the values of a consistent pair, a rate alone and a scale alone", () => {
    const expected = {
      mean: 1,
      variance: 0.5,
      sd: 0.7071067811865476,
      median: 0.8391734950083303,
      mode: 0.5,
      skewness: 1.414213562373095,
      kurtosis: 3,
    };
    expect(distSummary("gamma", { shape: 2, rate: 2, scale: 0.5 })).toEqual(expected);
    expect(distSummary("gamma", { shape: 2, rate: 2 })).toEqual(expected);
    expect(distSummary("gamma", { shape: 2, scale: 0.5 })).toEqual(expected);
    expect(distSummary("gamma", { shape: 2 }).mean).toBe(2);
    expect(distSummary("gamma", { shape: 2, rate: undefined, scale: 0.5 })).toEqual(expected);
  });
});
