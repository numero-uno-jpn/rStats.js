// Issue #24: dmultinom and dbinom where the denominator 2 pi x (n - x) / n overflows (review_fix_log_issue24.md).
import { describe, expect, it } from "vitest";
import { dbinom, dmultinom } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #24", () => {
  it("gives the central binomial and multinomial probabilities at counts of 8e307", () => {
    // 2 pi x overflowed: 0 for 6.3e-155 (the logarithm was right); R's dbinom: 6.307831305050802e-155
    const want = 1 / (Math.sqrt(Math.PI) * Math.sqrt(8e307)); // C(2m, m) / 4^m to far below double precision
    expect(rel(dbinom(8e307, 1.6e308, 0.5), 6.307831305050802e-155)).toBeLessThan(1e-13);
    expect(rel(dmultinom([8e307, 8e307], [0.5, 0.5]), want)).toBeLessThan(1e-13);
    for (const v of [dbinom(8e307, 1.6e308, 0.5, { log: true }), dmultinom([8e307, 8e307], [0.5, 0.5], { log: true })]) {
      expect(rel(Math.exp(v), want)).toBeLessThan(1e-12);
    }
  });

  it("leaves ordinary counts as before", () => {
    expect(rel(dbinom(5e306, 1e307, 0.5), 1 / Math.sqrt(Math.PI * 5e306))).toBeLessThan(1e-13);
    expect(dbinom(3, 10, 0.4)).toBeCloseTo(0.214990848, 9);
  });
});
