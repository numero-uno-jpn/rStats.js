// Issue #278: fisherTest's simulation rejects a fractional B, as chisqTest (review_fix_log_issue278.md).
import { describe, expect, it } from "vitest";
import { fisherTest, setSeed } from "../src/index.js";

describe("issue #278: fisherTest with a fractional B", () => {
  const t = [
    [8, 2, 1],
    [1, 7, 3],
    [2, 1, 9],
  ];

  it("a fractional B is an error", () => {
    expect(() => fisherTest(t, { simulatePValue: true, B: 2.5 })).toThrow("'B' must be a positive integer");
    expect(() => fisherTest(t, { simulatePValue: true, B: NaN })).toThrow("'B' must be a positive integer");
  });

  it("an integer B is unchanged", () => {
    // set.seed(1); fisher.test(t, simulate.p.value = TRUE, B = 2)$p.value: 0x1.5555555555555p-2 (1/3)
    setSeed(1);
    expect(fisherTest(t, { simulatePValue: true, B: 2 }).pValue).toBe(1 / 3);
  });
});
