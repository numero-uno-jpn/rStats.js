// Issue #212: optimize with an end beyond Number.MAX_VALUE / 2 searches over x / 2, as the midpoint 0.5 (a + b) of a
// bracket narrowed near that end overflows (the search did not end; R does not either). The objectives count their
// evaluations and throw beyond 100000, so the calls cannot hang.
import { describe, expect, it } from "vitest";
import { optimize } from "../src/index.js";

const counted = (g: (x: number) => number) => {
  let n = 0;
  return (x: number) => {
    if (++n > 100000) throw new Error("more than 100000 evaluations");
    return g(x);
  };
};

describe("issue #212", () => {
  it("ends for brackets with one end beyond Number.MAX_VALUE / 2 and the other near 0", () => {
    const neg = optimize(counted((x) => (x / 1e308 + 1.6) ** 2), -1.7e308, 1e306);
    expect(Math.abs(neg.optimum / -1.6e308 - 1)).toBeLessThan(1e-8);
    const pos = optimize(counted((x) => (x / 1e308 - 1.6) ** 2), -1e306, 1.7e308);
    expect(Math.abs(pos.optimum / 1.6e308 - 1)).toBeLessThan(1e-8);
    expect(pos.optimum).toBe(-neg.optimum);
    const pos2 = optimize(counted((x) => (x / 1e308 - 1.69) ** 2), -1e300, 1.7e308);
    expect(Math.abs(pos2.optimum / 1.69e308 - 1)).toBeLessThan(1e-8);
  });

  it("keeps the result of the issue's bracket", () => {
    // the value before the change (upper + lower overflows: already searched over x / 2)
    expect(optimize(counted((x) => (x / 1e308 - 1.1) ** 2), 1e308, 1.7e308).optimum).toBe(1.1000000004370132e308);
  });
});
