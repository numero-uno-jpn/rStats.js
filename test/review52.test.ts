// External review of Bessel functions at huge finite x (review_fix_log_20261031_52.md). Reference values from MPFR
// with the exact doubles (mantissa and exponent passed as strings: R on Windows does not round 1e308 correctly).
import { describe, expect, it } from "vitest";
import { besselI, besselJ, besselK, besselY } from "../src/index.js";

const scaled = { exponScaled: true };
const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("review 52", () => {
  it("SPEC-006: besselJ and besselY where pi x overflows", () => {
    // -0 and 0 before (R: 0, "value out of range")
    expect(rel(besselJ(1e308, 0), -2.4706564120790082e-155)).toBeLessThan(1e-13);
    expect(rel(besselY(1e308, 0), 7.5866879552418034e-155)).toBeLessThan(1e-13);
    expect(rel(besselJ(1e308, 1), 7.5866879552418034e-155)).toBeLessThan(1e-13);
    // below the overflow as before
    expect(besselJ(1e307, 0)).toBe(-9.489750003344774e-155); // MPFR -9.4897500033447795e-155
  });

  it("SPEC-007: besselI and besselK scaled where 2 x pi or 2 x overflows", () => {
    // 0 before (R: 0 for I, the right value for K)
    expect(rel(besselI(1e308, 0, scaled), 1 / (Math.sqrt(2 * Math.PI) * Math.sqrt(1e308)))).toBeLessThan(1e-15);
    expect(besselK(1e308, 0, scaled)).toBe(1.2533141373155001e-154);
    expect(besselI(1e307, 0, scaled)).toBe(1.26156626101008e-154);
    // the reflection for a negative order: the K term carries e^-2x
    expect(besselI(1e308, -0.3, scaled)).toBe(besselI(1e308, 0.3, scaled));
  });

  it("results far out of range return at once (found while fixing SPEC-007)", () => {
    // e^y was applied in steps of 700: |y| / 700 turns, and none ended at y = -2e308
    const t0 = performance.now();
    expect(besselI(1e12, 0)).toBe(Infinity);
    expect(besselK(1e12, 0)).toBe(0);
    expect(besselI(1e300, 2)).toBe(Infinity);
    expect(besselI(1e12, -0.3, scaled)).toBe(besselI(1e12, 0.3, scaled));
    expect(performance.now() - t0).toBeLessThan(200);
    // within range as before
    expect(besselI(700, 0)).toBe(1.5295933476718727e302);
  });
});
