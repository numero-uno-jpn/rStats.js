import { describe, expect, it } from "vitest";
import { brunnerMunzelTest } from "../src/index.js";

// #320: the variance estimate S_i^2 divides by n_i - 1, so a sample of one value gave a NaN statistic, df, p-value and
// interval (lawstat's brunner.munzel.test too). Each sample now needs at least 2 values.
describe("brunnerMunzelTest needs at least 2 values in each sample (#320)", () => {
  it("rejects a sample of one value", () => {
    expect(() => brunnerMunzelTest([1], [2, 3])).toThrow("not enough 'x' observations");
    expect(() => brunnerMunzelTest([1, NaN], [2, 3])).toThrow("not enough 'x' observations");
    expect(() => brunnerMunzelTest([2, 3], [1])).toThrow("not enough 'y' observations");
  });

  it("keeps lawstat's values for two values each", () => {
    // lawstat: statistic 0, df 1, p 1, estimate 1/2, interval -0x1.76993aacc4d1ep+2 0x1.b6993aacc4d1ep+2 (rStats.js
    // is 2 ulps away in the lower end, as before the fix)
    const r = brunnerMunzelTest([1, 4], [2, 3]);
    expect([r.statistic, r.parameter, r.pValue, r.estimate]).toEqual([0, 1, 1, 0.5]);
    expect(r.confInt![0]).toBeCloseTo(-5.853102368087347, 14);
    expect(r.confInt![1]).toBeCloseTo(6.853102368087347, 14);
  });
});
