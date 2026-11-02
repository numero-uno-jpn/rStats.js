// Issue #124: ode's RK4 update where h/6 underflows or the weighted slope sum overflows (review_fix_log_issue124.md).
import { describe, expect, it } from "vitest";
import { ode } from "../src/index.js";

describe("issue #124", () => {
  it("keeps the increment of a subnormal step and of a huge slope", () => {
    expect(ode([0], [0, Number.MIN_VALUE], () => [1], [], { method: "rk4" })[1]![1]).toBe(Number.MIN_VALUE);
    // the doubles 1e308 and 1e-308 multiply to 1 - 8e-17, correctly rounded 0.9999999999999999
    expect(ode([0], [0, 1e-308], () => [1e308], [], { method: "rk4" })[1]![1]).toBe(1e308 * 1e-308);
  });

  it("keeps ordinary steps as before", () => {
    const out = ode([1], [0, 0.5, 1], (t, y, p) => [-p[0]! * y[0]!], [0.7], { method: "rk4" });
    expect(out[2]![1]).toBe(0.4966435653972032); // (as before)
  });
});
