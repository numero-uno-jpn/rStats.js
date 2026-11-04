// Issue #507: ansariTest's interval and estimate rank x / s against y; for a finite s, x / s can overflow to Infinity
// or fall to 0, which tied distinct observations and changed AB(s). R 4.5.2's ansari.test does the same. Only there
// are the ranks now taken by a comparison of x / s that keeps the order; the results equal those of data with the
// same order and no overflow.
import { describe, expect, it } from "vitest";
import { ansariTest } from "../src/index.js";

describe("issue #507", () => {
  it("x / s overflows: the estimate is that of the same data without overflow", () => {
    const r = ansariTest([1e-308, 1.2e308, 1.3e308, 1.4e308, 1.5e308], [1.1e308], { exact: true, confInt: true });
    const ref = ansariTest([1e-308, 1.2, 1.3, 1.4, 1.5], [1.1], { exact: true, confInt: true });
    expect(r.estimate).toBe(1.3181818181818183); // R 4.5.2: 0.6363636
    const [e, eRef] = [r.estimate as number, ref.estimate as number];
    expect(Math.abs(e - eRef) / eRef).toBeLessThan(1e-15);
    expect(r.confInt).toEqual([NaN, NaN]);
  });

  it("x / s falls to +-0 across the middle of the ranks: the interval of the same order without underflow", () => {
    const r = ansariTest([-2e-160, -1e-160, 1e-160, 2e-160, 1e140], [5e-150, -5e-150], { exact: true, confInt: true });
    const ref = ansariTest([-2e-160, -1e-160, 1e-160, 2e-160, 1e-140], [5e-150, -5e-150], { exact: true, confInt: true });
    expect(ref.confInt).toEqual([NaN, NaN]);
    expect(r.confInt).toEqual([NaN, NaN]); // R 4.5.2: [2e-11, 4e-11]
    expect(r.estimate).toBe(ref.estimate);
  });
});
