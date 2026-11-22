import { describe, expect, it } from "vitest";
import { tamhaneT2Test, pageTest } from "../src/entries/tests.js";

describe("1.9.0 numerical tails", () => {
  it("keeps Tamhane T2 probabilities in the subnormal range", () => {
    const eps = 2 ** -53;
    const a = Array.from({ length: 11 }, (_, i) => -0.5 + i * eps);
    const b = Array.from({ length: 11 }, (_, i) => 0.5 + i * eps);
    const expected = 1.495557610914535e-304;
    for (const factor of [1, 2 ** 500, 2 ** -500, 2 ** 1000, 2 ** -1000]) {
      const result = tamhaneT2Test([a.map((v) => v * factor), b.map((v) => v * factor)]);
      // mpmath (100 dps), t = 1/(sqrt(2) * 2^-53), df = 20:
      // 2 * Pr(T_20 > t) = 1.4955576109145349573...e-304.
      expect(result.pValue[0]![0]! / expected).toBeCloseTo(1, 7);
      expect(Number.isFinite(result.statistic[0]![0]!)).toBe(true);
    }
    const ordinary = tamhaneT2Test([[-3, -2, -1], [1, 2, 3]]);
    const tiny = tamhaneT2Test([[-3e-310, -2e-310, -1e-310], [1e-310, 2e-310, 3e-310]]);
    expect(tiny.pValue[0]![0]).toBeCloseTo(ordinary.pValue[0]![0]!, 12);
  });

  it("keeps Page's upper normal tail below 1e-300", () => {
    const n = 1400;
    const y = Array.from({ length: n }, () => [1, 2]);
    const result = pageTest(y, { alternative: "greater" });
    // z = (n - 1) / sqrt(n); mpmath erfc(z / sqrt(2)) / 2
    // = 2.856592642148315428956...e-306.
    expect(result.statistic).toBeCloseTo((n - 1) / Math.sqrt(n), 12);
    expect(result.pValue / 2.8565926421483154e-306).toBeCloseTo(1, 7);
  });

  it("preserves Page ranks under extreme scales and accepts one block", () => {
    const y = [[1, 2], [3, 2], [4, 6], [8, 7]];
    const base = pageTest(y, { alternative: "greater" });
    for (const factor of [2 ** 500, 2 ** -500, 2 ** 1000, 2 ** -1000, 1e-310]) {
      const scaled = pageTest(y.map((row) => row.map((v) => v * factor)), { alternative: "greater" });
      expect(scaled.estimate).toBe(base.estimate);
      expect(scaled.statistic).toBe(base.statistic);
      expect(scaled.pValue).toBe(base.pValue);
    }
    expect(Number.isFinite(pageTest([[1, 2]], { alternative: "greater" }).statistic)).toBe(true);
    expect(Number.isFinite(pageTest([[1, 1], [1, 1]]).pValue)).toBe(true);
  });

  it("keeps Tamhane T2 invariant under large translations", () => {
    const groups = [[-3, -2, -1], [1, 2, 3]];
    const base = tamhaneT2Test(groups);
    for (const shift of [1e8, 1e12]) {
      const shifted = tamhaneT2Test(groups.map((group) => group.map((v) => v + shift)));
      const tolerance = shift === 1e8 ? 1e-7 : 1e-3;
      expect(Math.abs(shifted.statistic[0]![0]! - base.statistic[0]![0]!)).toBeLessThan(tolerance);
      expect(Math.abs(shifted.pValue[0]![0]! - base.pValue[0]![0]!)).toBeLessThan(tolerance);
    }
  });

  it("keeps Page ranks unchanged after large translations", () => {
    const y = [[1, 2], [3, 2], [4, 6], [8, 7]];
    const base = pageTest(y, { alternative: "greater" });
    for (const shift of [1e8, 1e12]) {
      const shifted = pageTest(y.map((row) => row.map((v) => v + shift)), { alternative: "greater" });
      expect(shifted.statistic).toBe(base.statistic);
      expect(shifted.pValue).toBe(base.pValue);
    }
  });

  it("applies Sidak adjustment without losing tiny pairwise tails", () => {
    const eps = 2 ** -53;
    const groups = [
      Array.from({ length: 11 }, (_, i) => -0.5 + i * eps),
      Array.from({ length: 11 }, (_, i) => i * eps),
      Array.from({ length: 11 }, (_, i) => 0.5 + i * eps),
    ];
    const result = tamhaneT2Test(groups);
    const values = result.pValue.flat().filter(Number.isFinite).sort((a, b) => a - b);
    // mpmath (100 dps): for df=20, the two 0.5-separated pairs have
    // p=1.5682058174223194e-298, and the 1-separated pair has
    // p=1.4955576109145350e-304. Sidak with m=3 is 1-(1-p)^3.
    expect(values[0]! / 4.486672832743605e-304).toBeCloseTo(1, 7);
    expect(values[1]! / 4.704617452266958e-298).toBeCloseTo(1, 7);
    expect(values[2]! / 4.704617452266958e-298).toBeCloseTo(1, 7);
    const tied = tamhaneT2Test([groups[0]!, groups[0]!, groups[0]!]);
    expect(tied.pValue.flat().filter(Number.isFinite)).toEqual([1, 1, 1]);
  });
});
