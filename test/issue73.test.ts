// Issue #73: kappa of a finite matrix far from 1 in scale (review_fix_log_issue73.md).
import { describe, expect, it } from "vitest";
import { kappa, type KappaOptions } from "../src/index.js";

const A = [
  [1, 1],
  [0, 1],
];
const W = [
  [1, 2, 3],
  [4, 5, 7],
];
const times = (m: number[][], c: number) => m.map((r) => r.map((v) => v * c));

const OPTIONS: KappaOptions[] = [
  { method: "direct", triangular: true },
  { method: "direct", triangular: true, uplo: "L" },
  { method: "direct", triangular: true, norm: "I" },
  {},
  { method: "direct" },
  { exact: true },
  { exact: true, norm: "1" },
  { exact: true, norm: "I" },
  { exact: true, norm: "F" },
];

describe("issue #73", () => {
  it("gives the same condition number for the matrix times a power of 2 (it was Infinity or NaN near 1e308)", () => {
    for (const o of OPTIONS) {
      const ref = kappa(A, o);
      for (const c of [2 ** 1000, 2 ** -1000]) expect(kappa(times(A, c), o), `${JSON.stringify(o)} ${c}`).toBe(ref);
    }
    // a wide matrix through the QR (transposed first): divided by 2^k for its largest entry, which is not the 2^1000
    // it was multiplied by, so the QR rounds differently (1 ulp here)
    expect(Math.abs(kappa(times(W, 2 ** 1000)) / kappa(W) - 1)).toBeLessThanOrEqual(1e-15);
    // (1e307 W rounds each product: a matrix 1e-16 away from a multiple of W, which a condition number of 22 turns into
    // 2e-15)
    expect(Math.abs(kappa(times(W, 1e307)) / kappa(W) - 1)).toBeLessThanOrEqual(1e-14);
  });

  it("gives a finite value near that of A for 1e308 A (R: Inf or an error)", () => {
    for (const o of OPTIONS) {
      const ref = kappa(A, o);
      const v = kappa(times(A, 1e308), o);
      expect(Math.abs(v / ref - 1), JSON.stringify(o)).toBeLessThanOrEqual(1e-15);
    }
  });
});
