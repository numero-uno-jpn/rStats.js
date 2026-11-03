// Issue #367: coxph's risk sums overflowed when a finite linear predictor exceeded exp's range
// (review_fix_log_issue367.md).
import { describe, expect, it } from "vitest";
import { coxph } from "../src/index.js";

describe("issue #367: coxph keeps the risk sums in a shifted (log-sum-exp) scale where exp(eta) overflows", () => {
  it("gives the finite log partial likelihood at an initial value that overflows exp (was -Inf; survival -Inf or an error)", () => {
    // risk set {0, 1000} at the death: -log(1 + e^1000) = -1000 in doubles
    expect(coxph([1, 2], [1, 0], [[0], [1]], { init: [1000], control: { iterMax: 0 } }).loglik).toEqual([-1000, -1000]);
    expect(coxph([1, 2], [1, 0], [[0], [2]], { init: [1000], control: { iterMax: 0 } }).loglik).toEqual([-2000, -2000]);
    const c = coxph([1, 2, 3, 4], [1, 1, 0, 1], [[0], [800], [1600], [2400]], { init: [1], control: { iterMax: 0 } });
    expect(c.loglik).toEqual([-4000, -4000]);
    expect(c.coefficients).toEqual([1]);
  });

  it("iterating from a saturated initial value gives NaN coefficients and a finite loglik, as before and as survival (NA)", () => {
    const f = coxph([1, 2, 3, 4, 5, 6], [1, 0, 1, 1, 0, 1], [[3000], [1000], [2000], [1500], [500], [2500]], { init: [0.5] });
    expect(f.loglik).toEqual([-750, -750]); // survival: -750 -750, coefficient NA
    expect(f.coefficients[0]).toBeNaN();
  });

  it("leaves an ordinary fit unchanged", () => {
    const f = coxph([1, 2, 3, 4, 5, 6], [1, 0, 1, 1, 0, 1], [[3000], [1000], [2000], [1500], [500], [2500]]);
    expect(f.loglik).toEqual([-4.276666119016054, -3.5357606207666024]); // survival -4.27666611901605442, -3.53576062076660191
  });
});
