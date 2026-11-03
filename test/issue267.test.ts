// Issue #267: gebal's comparison c + r >= 0.95 (c0 + r0) where both sums overflow. gebal is internal; eigen divides
// the matrix by a power of 2 so that its largest entry is at most 2^459 before balancing, so the sums are finite.
import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";
import { eigen } from "../src/index.js";

describe("issue #267", () => {
  it("gebal is not part of the public API", () => {
    expect("gebal" in api).toBe(false);
  });

  it("eigen of the issue's matrix is that of the matrix divided by 2^100, scaled back", () => {
    const big = eigen([[0, 1.6e308], [6e307, 0]]).values as number[];
    const small = (eigen([[0, 1.6e308 / 2 ** 100], [6e307 / 2 ** 100, 0]]).values as number[]).map((v) => v * 2 ** 100);
    expect(big).toEqual(small);
    // +-sqrt(1.6e308 * 6e307) = +-9.797958971132712e307; R 4.5.2: 9.797959e+307 -9.797959e+307
    expect(Math.abs(big[0]! / 9.797958971132712e307 - 1)).toBeLessThan(1e-15);
    expect(Math.abs(big[1]! / -9.797958971132712e307 - 1)).toBeLessThan(1e-15);
  });
});
