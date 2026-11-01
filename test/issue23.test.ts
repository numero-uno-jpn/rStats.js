// Issue #23: pbvnorm at correlation -1 (review_fix_log_issue23.md).
import { describe, expect, it } from "vitest";
import { pbvnorm } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #23", () => {
  it("gives P(h < X < -k) for Y = -X at correlation -1, as mvtnorm", () => {
    // the orthant was Φ(k) − Φ(h) instead of Φ(−k) − Φ(h): 0.1499 for 0.5328
    const cases: [number[], number[], number][] = [
      [[-1, -0.5], [Infinity, Infinity], 0.532807207342556],
      [[0.3, -2], [Infinity, Infinity], 0.359338445862868],
      [[-Infinity, -Infinity], [0.4, 0.2], 0.234681451049427],
      [[-1, -0.5], [1.5, 0.7], 0.44949880905094],
    ];
    for (const [lower, upper, want] of cases) {
      expect(rel(pbvnorm(lower, upper, -1), want)).toBeLessThan(1e-14);
      // continuous at -1
      expect(Math.abs(pbvnorm(lower, upper, -1 + 1e-12) - want)).toBeLessThan(1e-5);
    }
    // an empty interval of X, and tails far out
    expect(pbvnorm([0.6, -0.5], [Infinity, Infinity], -1)).toBe(0);
    expect(rel(pbvnorm([8, -9], [Infinity, Infinity], -1), 6.220960574271785e-16 - 1.1285884059538408e-19)).toBeLessThan(1e-12);
  });

  it("leaves correlation 1 and others as before", () => {
    expect(pbvnorm([-1, -0.5], [Infinity, Infinity], 1)).toBe(0.6914624612740131);
    expect(pbvnorm([-1, -0.5], [Infinity, Infinity], -0.999999)).toBeCloseTo(0.532807207342556, 6);
  });
});
