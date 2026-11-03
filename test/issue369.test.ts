// Issue #369 (input check only): subdivisions as R's as.integer; beyond the integer range it is NA, and R 4.5.2 stops
// (with the warning "NAs introduced by coercion to integer range", then "missing value where TRUE/FALSE needed").
// A resource limit below 2147483647 is not part of this fix.
import { describe, expect, it } from "vitest";
import { integrate } from "../src/index.js";

const f = (x: number) => x;

describe("issue #369", () => {
  it("subdivisions far beyond the integer range", () => {
    expect(() => integrate(f, 0, 1, { subdivisions: 1e300 })).toThrow("invalid parameter values");
  });

  // (before the fix these reach the typed-array allocation: excluded from the stash check with -t)
  it("alloc: just beyond the integer range, and the issue's 2^32", () => {
    for (const subdivisions of [2147483648, 2 ** 32]) {
      expect(() => integrate(f, 0, 1, { subdivisions })).toThrow("invalid parameter values");
    }
  });

  it("valid subdivisions are unchanged", () => {
    expect(integrate(f, 0, 1, { subdivisions: 100.7 }).value).toBe(0.5);
  });
});
