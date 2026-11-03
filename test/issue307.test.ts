// Issue #307: the exact one-sample ksTest has a work limit on its matrix power (review_fix_log_issue307.md).
import { describe, expect, it } from "vitest";
import { ksTest, punif } from "../src/index.js";
import { checkKolmogorovExactSize } from "../src/htest/core/kolmogorov.js";

describe("issue #307", () => {
  it("allows the matrix power up to 2^33 multiply-adds (boundary)", () => {
    // n 1023: 9 squarings and 9 products; m 781: 781^3 * 18 = 8.6e9 <= 2^33 (3.6 s on the development machine)
    expect(() => checkKolmogorovExactSize(1023, 390.5 / 1023)).not.toThrow();
    // m 783: 8.64e9 > 2^33
    expect(() => checkKolmogorovExactSize(1023, 391.5 / 1023)).toThrow(/783 x 783 matrix.*use exact: false/);
    // no matrix: d < 1/n (closed form) and d >= 1
    expect(() => checkKolmogorovExactSize(1e7, 0.5e-7)).not.toThrow();
    expect(() => checkKolmogorovExactSize(1e7, 1)).not.toThrow();
  });

  it("is a RangeError before the matrix is built (the issue's size)", () => {
    // D = 0.4 at n 1e4: an 8001 x 8001 matrix (512 MB) raised to the 1e4-th power
    const n = 1e4;
    const x = Array.from({ length: n }, (_, i) => (0.6 * (i + 1)) / n);
    expect(() => ksTest(x, (q: number) => punif(q), { exact: true })).toThrow(RangeError);
    expect(() => ksTest(x, (q: number) => punif(q), { exact: true })).toThrow(/use exact: false/);
    // D >= 1/2 and the one-sided tests use the Birnbaum-Tingey sum: no limit
    expect(ksTest(x, () => 0.4999, { exact: true }).pValue).toBeLessThan(1e-300);
    expect(ksTest(x, (q: number) => punif(q), { exact: true, alternative: "greater" }).exact).toBe(true);
    expect(ksTest(x, (q: number) => punif(q), { exact: false }).exact).toBe(false);
  });
});
