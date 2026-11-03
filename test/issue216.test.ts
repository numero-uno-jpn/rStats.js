// Issue #216: hermiteInterp with finite nodes whose separation overflows (review_fix_log_issue216.md).
import { describe, expect, it } from "vitest";
import { hermiteInterp } from "../src/index.js";

describe("issue #216: hermiteInterp over nodes whose range overflows", () => {
  it("gives the cubic through (-1e308, -1), (1e308, 1) with zero slopes (was -1)", () => {
    // the same cubic on (-1, 1) at 0 and 0.5: 0 and 0.6875
    expect(hermiteInterp([-1e308, 1e308], [-1, 1], [0, 0], [0, 0.5e308])).toEqual([0, 0.6875]);
  });

  it("agrees with the nodes divided by 1e308 and the slopes times 1e308", () => {
    const big = hermiteInterp([-1e308, 1e308], [-1, 1], [1e-308, 2e-308], [0.5e308, -0.3e308]);
    // hermiteInterp([-1, 1], [-1, 1], [1, 2], [0.5, -0.3]) is [0.21875, -0.45925000000000005]
    expect(big[0]).toBeCloseTo(0.21875, 14);
    expect(big[1]).toBeCloseTo(-0.45925, 14);
  });

  it("leaves nodes whose range is finite as before", () => {
    expect(hermiteInterp([0, 1], [0, 1], [0, 0], [0.25, 0.5])).toEqual([0.15625, 0.5]);
    expect(hermiteInterp([-1, 1], [-1, 1], [1, 2], [0.5, -0.3])).toEqual([0.21875, -0.45925000000000005]);
  });
});
