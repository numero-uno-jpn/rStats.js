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

describe("issue #216 follow-up: hermiteInterp where the divided differences underflow or overflow", () => {
  it("gives the cubic through (-1e200, -1), (1e200, 1) with zero slopes (was -1)", () => {
    const r = hermiteInterp([-1e200, 1e200], [-1, 1], [0, 0], [0, 0.5e200, -1e200, 1e200]);
    // exact: 0, 0.6875 and the node values; the same as the nodes divided by 2^664 (exact)
    const c = 2 ** -664;
    expect(r).toEqual(hermiteInterp([-1e200 * c, 1e200 * c], [-1, 1], [0, 0], [0, 0.5e200 * c, -1e200 * c, 1e200 * c]));
    expect(r[0]).toBeCloseTo(0, 14);
    expect(r[1]).toBeCloseTo(0.6875, 14);
    expect(hermiteInterp([-1e300, 1e300], [-1, 1], [0, 0], [0.5e300])[0]).toBeCloseTo(0.6875, 14);
    // 1e150: the third difference underflowed to a subnormal (0.12499999999999978)
    expect(hermiteInterp([-1e150, 1e150], [-1, 1], [0, 0], [0.5e150])[0]).toBeCloseTo(0.6875, 14);
  });

  it("gives the cubic through tiny nodes, whose differences overflowed (was NaN)", () => {
    const r = hermiteInterp([-1e-200, 1e-200], [-1, 1], [0, 0], [0.5e-200]);
    expect(r[0]).toBeCloseTo(0.6875, 14);
  });

  it("agrees with the nodes scaled to order 1 for three nodes and nonzero slopes", () => {
    // nodes 0, 1, 3 times 1e200 (old 1.5 and 3) and times 1e-200 (old NaN); the unscaled call at 0.5 and 2
    const ref = hermiteInterp([0, 1, 3], [1, -2, 0.5], [1, 0, -3], [0.5, 2]);
    const big = hermiteInterp([0, 1e200, 3e200], [1, -2, 0.5], [1e-200, 0, -3e-200], [0.5e200, 2e200]);
    const tiny = hermiteInterp([0, 1e-200, 3e-200], [1, -2, 0.5], [1e200, 0, -3e200], [0.5e-200, 2e-200]);
    for (const r of [big, tiny]) {
      expect(r[0]).toBeCloseTo(ref[0]!, 13);
      expect(r[1]).toBeCloseTo(ref[1]!, 13);
    }
  });

  it("leaves nodes of 1e100, whose differences stay normal, as before", () => {
    expect(hermiteInterp([-1e100, 1e100], [-1, 1], [0, 0], [0.5e100])).toEqual([0.6875000000000002]);
  });
});
