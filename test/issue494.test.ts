// Issue #494: the exact 2 x 2 x K test with counts from 2^53 on did not return (a stratum's support loop x++ does not
// advance at 1e16); such counts are now a RangeError before the loop, pointing to exact: false.
import { describe, expect, it } from "vitest";
import { mantelhaenTest } from "../src/index.js";

const message = "the exact test needs counts with a total below 2^53: use exact: false";

describe("issue #494", () => {
  it("the issue's table (the loop did not end)", () => {
    expect(() => mantelhaenTest([[[1e16, 0], [1e16, 0]], [[1, 0], [1, 0]]], { exact: true })).toThrow(message);
  });

  it("a total from 2^53 on", () => {
    expect(() => mantelhaenTest([[[2 ** 52, 0], [2 ** 52, 0]], [[1, 0], [1, 0]]], { exact: true })).toThrow(message);
  });

  it("totals below 2^53 and the asymptotic test are computed", () => {
    const r = mantelhaenTest([[[2 ** 52, 0], [0, 1]], [[1, 0], [1, 1]]], { exact: true });
    expect(r.statistic).toBe(2 ** 52 + 1);
    expect(r.pValue).toBeGreaterThan(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
    expect(() => mantelhaenTest([[[1e16, 0], [1e16, 0]], [[1, 0], [1, 0]]])).not.toThrow();
  });
});
