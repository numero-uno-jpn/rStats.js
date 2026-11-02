// Issue #61: optimize replaces non-finite values of f as R does (review_fix_log_issue61.md).
import { describe, expect, it } from "vitest";
import { optimize } from "../src/index.js";

describe("issue #61", () => {
  it("searches with NaN and +Inf as the largest double and -Inf as the most negative (R 4.5.2)", () => {
    // R's optimum (17 digits) and objective; NaN and Inf took other paths before (0.2, 0.99993, 0.38197)
    const nan = optimize((x) => (x >= 0.5 ? NaN : (x - 0.2) ** 2), 0, 1);
    expect(nan.optimum).toBe(0.19999999999999996);
    expect(nan.objective).toBe(3.0814879110195774e-33);
    expect(optimize((x) => (x >= 0.5 ? Infinity : (x - 0.2) ** 2), 0, 1).optimum).toBe(0.19999999999999996);
    const neg = optimize((x) => (x >= 0.5 ? -Infinity : (x - 0.2) ** 2), 0, 1);
    expect(neg.optimum).toBe(0.61807982457087078);
    expect(neg.objective).toBe(-Infinity);
    expect(optimize((x) => (x < 0.3 ? NaN : (x - 0.7) ** 2), 0, 1).optimum).toBe(0.7);
    const all = optimize(() => NaN, 0, 1);
    expect(all.optimum).toBe(0.9999338930386481);
    expect(all.objective).toBeNaN();
  });

  it("replaces the values of -f when maximizing", () => {
    const f = (x: number) => (x >= 0.5 ? NaN : -((x - 0.2) ** 2));
    expect(optimize(f, 0, 1, { maximum: true }).optimum).toBe(0.19999999999999996);
  });

  it("leaves finite functions as before", () => {
    expect(optimize((x) => (x - 1 / 3) ** 2, 0, 1).optimum).toBe(0.3333333333333333);
    // (R: 0.20000000000000009, 1 ulp away; the same before this change)
    expect(optimize((x) => (x - 0.2) ** 2, 0, 1).optimum).toBe(0.20000000000000007);
  });
});
