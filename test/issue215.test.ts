// Issue #215: barylag with finite nodes whose differences overflow (review_fix_log_issue215.md).
import { describe, expect, it } from "vitest";
import { barylag } from "../src/index.js";

describe("issue #215: barylag over nodes whose range overflows", () => {
  it("interpolates the line through (-1e308, -1) and (1e308, 1) (was NaN, pracma too)", () => {
    const [a, b, c] = barylag([-1e308, 1e308], [-1, 1], [0, 0.5e308, -1e307]);
    expect(Math.abs(a!)).toBe(0);
    expect(b).toBeCloseTo(0.5, 15);
    expect(c).toBeCloseTo(-0.1, 15);
  });

  it("interpolates the parabola (x / 1e308)^2 (was NaN, pracma too)", () => {
    expect(barylag([-1e308, 0, 1e308], [1, 0, 1], [0.5e308, -0.25e308])).toEqual([0.25, 0.0625]);
  });

  it("agrees with the same nodes divided by 1e308", () => {
    const big = barylag([1e308, -1e308, 3e307, -2e307], [1, 2, 3, 4], [0, 5e307]);
    // barylag([1, -1, 0.3, -0.2], [1, 2, 3, 4], [0, 0.5]) is [3.725274725274725, 2.4038461538461537]
    expect(big[0]).toBeCloseTo(3.725274725274725, 13);
    expect(big[1]).toBeCloseTo(2.4038461538461537, 13);
  });

  it("leaves nodes whose range is finite as before", () => {
    expect(barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5])).toEqual([1.7500000000000002, 4.75]);
    expect(barylag([1e200, 2e200, 3e200], [1, 4, 9], [1.5e200])).toEqual([2.25]);
  });
});
