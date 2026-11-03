// Issue #211: ode with finite times whose difference overflows (review_fix_log_issue211.md).
import { describe, expect, it } from "vitest";
import { ode } from "../src/index.js";

const methods = ["euler", "rk2", "rk4"] as const;

describe("issue #211: ode over a step that overflows between finite times", () => {
  it("keeps the state under a zero derivative (was NaN: 1 + Inf * 0)", () => {
    for (const method of methods) {
      expect(ode([1], [-1e308, 1e308], () => [0], [], { method })).toEqual([[-1e308, 1], [1e308, 1]]);
    }
  });

  it("adds h times a constant slope, h = 2e308 (1 + 2e308 * 1e-300 = 1 + 2e8)", () => {
    for (const method of methods) {
      const out = ode([1], [-1e308, 1e308], () => [1e-300], [], { method });
      expect(out[1]![1]).toBeCloseTo(1 + 2e8, 5);
    }
  });

  it("rk4 integrates a slope linear in t exactly (y' = t 1e-300 over (-1e308, 1e308) adds 0)", () => {
    const out = ode([1], [-1e308, 1e308], (t) => [t * 1e-300], [], { method: "rk4" });
    expect(out[1]![1]).toBe(1);
  });

  it("calls func at the start, the midpoint and the end of the step", () => {
    const seen: number[] = [];
    ode([1], [-1e308, 1e308], (t) => { seen.push(t); return [0]; }, [], { method: "rk4" });
    expect(seen).toEqual([-1e308, 0, 0, 1e308]);
  });

  it("leaves steps that do not overflow as before", () => {
    const out = ode([1], [0, 0.5, 1], (_t, y, p) => [-p[0]! * y[0]!], [0.7], { method: "rk4" });
    expect(out[2]![1]).toBeCloseTo(0.49664, 5);
  });
});
