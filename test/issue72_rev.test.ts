// Revision of issue 72: expm's order limited to order * (n^3 + 64) <= 2^31 (review_fix_log_issue72_rev.md).
// Only the rejection beyond the limit is run (it comes before any computation); the orders inside it keep their values.
import { describe, expect, it } from "vitest";
import { expm } from "../src/index.js";

const METHODS = ["Taylor", "TaylorO", "Pade", "PadeO"] as const;
const square = (n: number) =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0.1 : 0.01)));

describe("issue 72 (revision)", () => {
  it("rejects order * (n^3 + 64) > 2^31 at once", () => {
    // 2 x 2: 2^31 / 72 = 29826161.8; 50 x 50: 2^31 / 125064 = 17171.3
    for (const [n, order] of [
      [2, 29826162],
      [2, 2147483647],
      [50, 17172],
    ] as const) {
      const A = square(n);
      for (const method of METHODS) {
        const t = performance.now();
        expect(() => expm(A, { method, order }), `${method} ${n} ${order}`).toThrow(
          `order = ${order} is too large for a ${n} x ${n} matrix: order * (n^3 + 64) must be at most 2^31`,
        );
        expect(performance.now() - t).toBeLessThan(100);
      }
    }
  });

  it("keeps the values inside the limit", () => {
    // the values before the revision (Taylor and Pade 1e5 equal R's expm 0x1.6a0c6d8248c4ep+1)
    const M = [
      [1, 0.5],
      [0.25, -0.5],
    ];
    expect(expm(M, { method: "Taylor", order: 1e5 })[0]![0]).toBe(2.8285042654183945);
    expect(expm(M, { method: "Pade", order: 1e5 })[0]![0]).toBe(2.8285042654183945);
    expect(expm(M, { method: "Pade", order: 8 })[0]![0]).toBe(2.8285042654183763);
    // the Higham08 methods ignore order, and a 1 x 1 matrix makes no products
    expect(expm(square(50), { method: "Higham08", order: 1e9 })[0]![0]).toBe(expm(square(50), { method: "Higham08" })[0]![0]);
    expect(expm([[1]], { method: "Taylor", order: 2147483647 })).toEqual([[Math.exp(1)]]);
  });
});
