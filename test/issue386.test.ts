// Issue #386: central() in distSummary divided the third and fourth central moments by v^1.5 and v^2, which
// underflow for a small variance v: kumar(1e-220, 1) had skewness and kurtosis Infinity. Where those powers are below
// the normal range, it now divides by v and sqrt(v) in turn (review_fix_log_issue386.md). References: Rmpfr (2000
// bits) from E[X^r] = a / (a + r) on the exact double.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const rel = (x: number, ref: number): number => Math.abs(x / ref - 1);

describe("issue #386", () => {
  it("gives the skewness and kurtosis of kumar(1e-220, 1)", () => {
    const s = distSummary("kumar", { a: 1e-220, b: 1 });
    // Rmpfr 0x1.4127cb1a937ccp+365 and 0x1.c5416bb92e3e6p+730
    expect(rel(s.skewness, 0x14127cb1a937cc * 2 ** (365 - 52))).toBeLessThan(3e-16);
    expect(s.kurtosis).toBe(0x1c5416bb92e3e6 * 2 ** (730 - 52));
    expect(s.variance).toBe(5e-221);
  });

  it("keeps the values where the powers are in range", () => {
    // the values before the change
    const s = distSummary("kumar", { a: 2, b: 3 });
    expect(s.skewness).toBe(0.07111942528060262);
    expect(s.kurtosis).toBe(-0.7342475021245347);
    const t = distSummary("kumar", { a: 1e-5, b: 1 });
    expect(t.skewness).toBe(298.13916712638473);
    expect(t.kurtosis).toBe(99996.41668173634);
  });
});
