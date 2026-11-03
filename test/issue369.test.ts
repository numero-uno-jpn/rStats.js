// Issue #369 (input check only): subdivisions as R's as.integer; beyond the integer range it is NA, and R 4.5.2 stops
// (with the warning "NAs introduced by coercion to integer range", then "missing value where TRUE/FALSE needed").
// Second part: QUADPACK's work arrays grow with the subintervals used, instead of 36 (subdivisions + 1) bytes up front.
import { afterEach, describe, expect, it } from "vitest";
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

  describe("work arrays grow with the subintervals used", () => {
    const Original = globalThis.Float64Array;
    afterEach(() => {
      globalThis.Float64Array = Original;
    });

    it("subdivisions 1e6 does not allocate 1e6 + 1 entries", () => {
      let maxLength = 0;
      globalThis.Float64Array = new Proxy(Original, {
        construct(target, args: unknown[]) {
          if (typeof args[0] === "number") maxLength = Math.max(maxLength, args[0]);
          return Reflect.construct(target, args);
        },
      });
      const r = integrate(f, 0, 1, { subdivisions: 1e6 });
      globalThis.Float64Array = Original;
      expect(r.value).toBe(0.5);
      expect(maxLength).toBeLessThan(1000);
    });

    it("the largest subdivisions runs without a large allocation", () => {
      expect(integrate(f, 0, 1, { subdivisions: 2147483647 }).value).toBe(0.5);
    });

    // more than the initial 128 entries: the values of the implementation before this change
    it("values unchanged when the arrays grow", () => {
      const r1 = integrate((x) => Math.sin(1 / x), 0, 1, { subdivisions: 1000 });
      expect([r1.value, r1.absError, r1.subdivisions, r1.ier]).toEqual([0.5041150964763239, 0.00009661119868742407, 176, 0]);
      const r2 = integrate((x) => Math.abs(Math.sin(50 * x)) * Math.exp(-x), 0, Infinity, { subdivisions: 500 });
      expect([r2.value, r2.absError, r2.subdivisions, r2.ier]).toEqual([0.6366369486743286, 0.000030007169374512976, 340, 0]);
    });
  });
});
