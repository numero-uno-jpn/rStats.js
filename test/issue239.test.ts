// Issue #239: distSummary("kumar") formed the mode ((a - 1) / (a b - 1))^(1/a) with a b, which overflows for
// a = b = 1e200 (mode 0 for a value that rounds to 1). Where a b overflows, the mode is now
// ((a - 1) / a)^(1/a) b^(-1/a) (review_fix_log_issue239.md). References: Rmpfr (400 bits) on the exact doubles.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const mode = (a: number, b: number): number => distSummary("kumar", { a, b }).mode;

describe("issue #239", () => {
  it("rounds to 1 for huge equal shapes", () => {
    expect(mode(1e200, 1e200)).toBe(1);
    expect(mode(1e300, 2)).toBe(1);
    expect(mode(1e154, 1e155)).toBe(1);
  });

  it("agrees with Rmpfr where a b overflows", () => {
    // the rounding of 1/a in the power, times log b (about 700), limits any double formula to about 1e-14 here
    const cases: [number, number, number][] = [
      [2, 1e308, 7.071067811865475e-155],
      [3, 1e308, 1.882072057762057e-103],
      [1.5, 1.7e308, 1.5665823020498064e-206],
    ];
    for (const [a, b, ref] of cases) expect(Math.abs(mode(a, b) / ref - 1), `${a} ${b}`).toBeLessThan(5e-14);
  });

  it("keeps the values where a b is finite", () => {
    expect(mode(2, 3)).toBe(0.4472135954999579);
    expect(mode(1e100, 1e100)).toBe(1);
  });
});
