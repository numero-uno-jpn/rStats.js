// Numerical core of the two-sample ks.test: the exact Smirnov distribution, with and without ties, checked against
// exact integer path counting (scripts/mpmath/smirnov.py, itself checked against brute-force enumeration)
import { describe, expect, it } from "vitest";
import { psmirnovUpper, type SmirnovAlternative } from "../../src/htest/core/smirnov.js";
import { num } from "../helpers/fixture.js";
import { referenceSuite } from "../helpers/mpmath.js";

referenceSuite({
  name: "psmirnov_upper",
  tolerance: 1e-13,
  call: (a) => {
    const z = (a as Record<string, unknown>).z as string[] | undefined;
    return psmirnovUpper(num(a.d), num(a.m), num(a.n), {
      alternative: a.alternative as unknown as SmirnovAlternative,
      ...(z !== undefined ? { z: z.map(num) } : {}),
    });
  },
});

describe("psmirnovUpper", () => {
  it("handles the ends and checks z", () => {
    expect(psmirnovUpper(0, 3, 4)).toBe(1);
    expect(psmirnovUpper(1.5, 3, 4)).toBe(0);
    expect(() => psmirnovUpper(0.5, 3, 4, { z: [1, 2, 3] })).toThrow(RangeError);
  });
});
