// Issue #114: the noncentral beta density with a subnormal second shape, where s / b overflowed in the small-shape
// kernel and the dominant j = 0 term was dropped (review_fix_log_issue114.md). As b -> 0 the log density is
// log b + (a - 1) log x - log(1 - x) - mu (1 - x) (mu = ncp / 2), with a relative correction of the order of b.
// R 4.5.2: dbeta(0.5, 0.75, 2^-1074, ncp = 0.1, log = TRUE) is -Inf.
import { describe, expect, it } from "vitest";
import { dbeta } from "../src/index.js";

const lead = (x: number, a: number, b: number, mu: number): number =>
  Math.log(b) + (a - 1) * Math.log(x) - Math.log1p(-x) - mu * (1 - x);

describe("issue #114", () => {
  it("keeps the j = 0 term for a subnormal shape", () => {
    for (const b of [Number.MIN_VALUE, 1e-310, 1e-315]) {
      for (const x of [0.2, 0.5, 0.8]) {
        const v = dbeta(x, 0.75, b, { ncp: 0.1, log: true });
        expect(Math.abs(v / lead(x, 0.75, b, 0.05) - 1), `${x}, ${b}`).toBeLessThan(1e-13);
        expect(dbeta(x, 0.75, b, { ncp: 0.1 }), `${x}, ${b}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps a normal small shape as before", () => {
    expect(dbeta(0.5, 0.75, 1e-300, { ncp: 0.1, log: true })).toBe(-689.9340939225137);
  });
});
