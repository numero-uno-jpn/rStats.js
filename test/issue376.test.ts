// Issue #376: distSummary squared the width of unif and arcsine and the scale of logis before the constant, so the
// variance was Infinity for unif(0, 2e154) and arcsine(0, 2e154) and 0 for logis(scale 1e-162) although it is
// representable. Where the variance leaves the normal range it is now formed from the parameter scaled to [1, 2)
// (review_fix_log_issue376.md). References: Rmpfr (2000 bits) on the exact doubles.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

describe("issue #376", () => {
  it("gives the representable variance where the square overflows or underflows", () => {
    const u = distSummary("unif", { min: 0, max: 2e154 });
    // Rmpfr 0x1.7bbef5d3a60d6p+1021: w^2 / 12 rounds twice, as in the ordinary range
    expect(Math.abs(u.variance / hex("0x1.7bbef5d3a60d6p+1021") - 1)).toBeLessThan(3e-16);
    expect(u.sd).toBe(hex("0x1.b8f12c593dc9cp+510"));
    const a = distSummary("arcsine", { a: 0, b: 2e154 });
    expect(a.variance).toBe(hex("0x1.1ccf385ebc8a0p+1022"));
    expect(a.sd).toBe(hex("0x1.0e0551a9edea1p+511"));
    // pi^2 scale^2 / 3 = 3.29e-324 rounds to the least subnormal
    expect(distSummary("logis", { location: 0, scale: 1e-162 }).variance).toBe(5e-324);
  });

  it("keeps the values in the normal range", () => {
    expect(distSummary("unif", { min: 0, max: 2e153 }).variance).toBe(2e153 ** 2 / 12);
    expect(distSummary("arcsine", { a: -3, b: 5 }).variance).toBe(8);
    expect(distSummary("logis", { location: 0, scale: 2 }).variance).toBe((4 * Math.PI * Math.PI) / 3);
    const big = distSummary("unif", { min: 0, max: 1e308 });
    expect(big.variance).toBe(Infinity);
    expect(big.sd).toBe(1e308 / 2 * (2 / Math.sqrt(12)));
  });
});
