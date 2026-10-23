// Numerical core of shapiro.test (Royston's approximations). SciPy implements the same algorithm (AS R94);
// the largest difference is 9e-12. The comparison with R is left to the R fixtures
import { describe, expect, it } from "vitest";
import { swilkCoefficients, swilkPValue, swilkW } from "../../src/htest/core/shapiro.js";
import { num } from "../helpers/fixture.js";
import { referenceSuite } from "../helpers/mpmath.js";

referenceSuite({
  name: "swilk_scipy",
  tolerance: 1e-10,
  call: (a) => {
    const x = (a.x as unknown as string[]).map(num);
    const w = swilkW(x);
    return a.what === "w" ? w : swilkPValue(w, x.length);
  },
});

describe("swilkCoefficients", () => {
  it("are antisymmetric with unit sum of squares", () => {
    for (const n of [3, 4, 5, 6, 11, 12, 50, 1001, 5000]) {
      const a = swilkCoefficients(n);
      let ss = 0;
      for (let i = 0; i < n; i++) {
        ss += a[i]! * a[i]!;
        expect(a[i]).toBeCloseTo(-a[n - 1 - i]!, 15);
      }
      expect(Math.abs(ss - 1)).toBeLessThan(1e-12);
      expect(a[n - 1]).toBeGreaterThan(0);
    }
  });
});
