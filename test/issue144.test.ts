// Issue #144: distSummary("triang") formed the skewness sqrt(2)(a+b-2c)(2a-b-c)(a-2b+c) / (5 q^1.5) from the
// parameters themselves, whose cubes overflow or underflow for wide or narrow supports (NaN for a = -1e308, b = 1e308,
// c = 0, a symmetric distribution). The skewness is scale-free, so it is now formed from the parameters divided by a
// power of 2 where their largest is outside [2^-300, 2^300] (review_fix_log_issue144.md).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const skew = (a: number, b: number, c: number): number => (distSummary("triang", { a, b, c }) as { skewness: number }).skewness;
const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #144", () => {
  it("is 0 for the symmetric distribution on [-1e308, 1e308]", () => {
    expect(skew(-1e308, 1e308, 0)).toBe(0);
  });

  it("does not depend on the scale", () => {
    const base = skew(0, 3, 1); // sqrt(2) (1)(-4)(-5) / (5 * 7^1.5)
    expect(base).toBe(0.305441419328485);
    for (const k of [-1074 + 2, -1000, -700, -400, -301, 301, 400, 700, 1000, 1022]) {
      const s = 2 ** k;
      expect(rel(skew(0, 3 * s, s), base), `k = ${k}`).toBeLessThan(1e-15);
    }
    expect(rel(skew(0, 3e200, 1e200), base)).toBeLessThan(1e-15);
    expect(rel(skew(0, 3e-120, 1e-120), base)).toBeLessThan(1e-15);
    expect(rel(skew(0, 3e120, 1e120), base)).toBeLessThan(1e-15);
    expect(rel(skew(0, 1.5e308, 1e308), -base)).toBeLessThan(1e-15);
  });

  it("keeps the bits where the parameters are within [2^-300, 2^300]", () => {
    expect(skew(-1, 1, 0)).toBe(0);
    expect(skew(0, 3e50, 1e50)).toBe(0.30544141932848495);
  });
});
