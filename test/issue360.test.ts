// Issue #360: ode rejects a time that is not finite (the step became infinite or NaN, and the state NaN even with
// a zero derivative).
import { describe, expect, it } from "vitest";
import { ode } from "../src/index.js";

describe("issue #360", () => {
  it("an infinite or NaN time is an error", () => {
    for (const times of [[0, Infinity], [0, NaN], [-Infinity, 0], [NaN], [0, 1, Infinity]]) {
      for (const method of ["euler", "rk2", "rk4"] as const) {
        expect(() => ode([0], times, () => [0], [], { method })).toThrow("'times' must be finite values");
      }
    }
  });

  it("finite times are unchanged", () => {
    expect(ode([1], [0, 0.5, 1], (t, y, p) => [-p[0]! * y[0]!], [0.7], { method: "euler" })).toEqual([
      [0, 1],
      [0.5, 0.65],
      [1, 0.42250000000000004],
    ]);
  });
});
