// Issue #34: distSummary("pareto") where intermediate products overflow (review_fix_log_issue34.md).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const near = (a: number, b: number) => expect(Math.abs(a / b - 1)).toBeLessThan(1e-14);

describe("issue #34", () => {
  it("gives the representable moments of large shapes and scales", () => {
    // a b, b² a, a³, 2 (1 + a) and b √a overflowed: Inf and NaN
    const big = distSummary("pareto", { a: 1e308, b: 1e308 });
    near(big.mean, 1e308);
    near(big.variance, 1);
    near(big.sd, 1);
    near(big.skewness, 2);
    near(big.kurtosis, 6);
    const s = distSummary("pareto", { a: 5, b: 1e308 });
    near(s.mean, 1.25e308);
    expect(s.variance).toBe(Infinity); // 1.04e615
    near(s.sd, (1e308 / 4) * Math.sqrt(5 / 3));
    near(distSummary("pareto", { a: 1e200, b: 1 }).kurtosis, 6);
    near(distSummary("pareto", { a: 1e154, b: 1e154 }).variance, 1);
  });

  it("leaves ordinary parameters as before", () => {
    const s = distSummary("pareto", { a: 5, b: 2 });
    expect([s.mean, s.variance, s.skewness, s.kurtosis]).toEqual([(5 * 2) / 4, (2 * 2 * 5) / (16 * 3), ((2 * 6) / 2) * Math.sqrt(3 / 5), (6 * (125 + 25 - 30 - 2)) / (5 * 2 * 1)]);
  });
});
