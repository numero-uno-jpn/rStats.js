// Issue #152: dmultinom where the total of the counts overflows.
import { describe, expect, it } from "vitest";
import { dmultinom } from "../src/index.js";

describe("issue #152", () => {
  it("NaN on both scales where the total overflows", () => {
    // the linear value was 0 (true 5.64e-155) and the log NaN; R stops with an error for counts above 2^31 - 1
    for (const [x, p] of [
      [[1e308, 1e308], [0.5, 0.5]],
      [[1e308, 1e308], [0.3, 0.7]],
      [[1e308, 1e308, 1], [1, 1, 1]],
    ]) {
      expect(dmultinom(x!, p!)).toBeNaN();
      expect(dmultinom(x!, p!, { log: true })).toBeNaN();
    }
  });

  it("an impossible outcome is still exactly 0", () => {
    expect(dmultinom([1e308, 1e308], [1, 0])).toBe(0);
    expect(dmultinom([1e308, 1e308], [1, 0], { log: true })).toBe(-Infinity);
  });

  it("totals in range as before", () => {
    expect(dmultinom([1e308, 7e307], [0.5, 0.5])).toBe(0);
    expect(dmultinom([1e308, 7e307], [0.5, 0.5], { log: true })).toBe(-2.6609719389104684e306);
    expect(dmultinom([1e300, 1e300], [0.5, 0.5])).toBe(5.641895835477563e-151);
    expect(dmultinom([1e300, 1e300], [0.5, 0.5], { log: true })).toBe(-345.96012889203143);
  });
});
