// Issue #483: ksTest, exact two-sided one-sample p-value for D < 1/2 and a small p-value (review_fix_log_issue483.md).
import { describe, expect, it } from "vitest";
import { ksTest } from "../src/index.js";
import { pkolmogorovExact, pkolmogorovExactUpper } from "../src/htest/core/kolmogorov.js";

const rel = (a: number, b: number) => Math.abs(a - b) / b;

describe("issue #483", () => {
  it("forms small upper tails as a sum of positive terms (references: Rmpfr, 256 bits)", () => {
    // 1 - P(D < d) gave 2.9976021664879227e-15 (R 4.5.2: 1.9984014443252818e-15); the true value is 2 P(D+ >= d)
    // up to a negligible term at d = 0.49
    const x = Array.from({ length: 99 }, (_, i) => (i + 1) / 99);
    const r = ksTest(x, (q: number) => 0.51 * q, { exact: true });
    expect(r.statistic).toBe(0.49);
    expect(rel(r.pValue, 1.9222472248029365e-22)).toBeLessThan(1e-13);
    // Marsaglia-Tsang-Wang's matrix in 256 bits; n 69 and 96 are R fixtures (R off by 8e-13 and 1.5e-12 relative)
    const refs: [number, number, number][] = [
      [20, 0.45, 3.2446411409554644e-4],
      [40, 0.4, 2.7416081587210552e-6],
      [69, 0.21541045842194384, 2.7331790336971829e-3],
      [96, 0.19864104999999999, 8.5305602375530878e-4],
    ];
    for (const [n, d, ref] of refs) expect(rel(pkolmogorovExactUpper(n, d), ref)).toBeLessThan(1e-13);
  });

  it("keeps 1 - P(D < d) where 2 P(D+ >= d) >= 1e-2, and where the sum needs too much work", () => {
    const x = Array.from({ length: 20 }, (_, i) => (i + 0.5) / 20 + 0.03);
    const r = ksTest(x, (q: number) => Math.min(1, q), { exact: true });
    expect(r.pValue).toBe(1 - pkolmogorovExact(20, r.statistic));
    // about 7e8 terms: the caller falls back to the matrix
    expect(pkolmogorovExactUpper(5000, 0.08)).toBeNaN();
  });
});
