// Issue #374: the double-double sum keeps two components, so a third band of magnitudes was rounded away and lost
// when the larger bands cancelled: sum([1e308, 1e308, 1e100, 1, -1e308, -1e308, -1e100]) was 0 (R Inf, true 1).
// User decision (2026-11-03): a bound on what the double-double lost is kept, and only where it could change the
// rounded result is the sum formed exactly (BigInt) and rounded once.
import { describe, expect, it } from "vitest";
import { sum } from "../src/descriptive/basic.js";

describe("issue #374: sum with three bands of magnitudes", () => {
  it("keeps the third band through the cancellation", () => {
    expect(sum([1e308, 1e308, 1e100, 1, -1e308, -1e308, -1e100])).toBe(1);
    expect(sum([1e308, 1e100, 1, -1e308, -1e100])).toBe(1);
    // without overflow: 1e-10 added to the low component 1e3 was rounded (1.000444171950221e-10 before)
    expect(sum([1e20, 1e3, 1e-10, -1e20, -1e3])).toBe(1e-10);
    expect(sum([1e30, 1e3, 1e-10, -1e30, -1e3])).toBe(1e-10);
  });

  it("keeps the ordinary values", () => {
    expect(sum([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sum([1e308, 1e308, -1e308])).toBe(1e308);
    expect(sum([1e308, 1e308])).toBe(Infinity);
    expect(sum([5e-324, 5e-324])).toBe(1e-323);
    expect(sum([])).toBe(0);
    expect(sum([1, Infinity, -Infinity])).toBeNaN();
  });
});
