// Issue #491: pbeta with shapes whose sum overflows, away from the mean. The issue's pbeta(0.1, 1e308, 5e307) is 0
// (a + b = 1.5e308 is finite there), but where a + b overflows the continued fraction and its prefactor form a + b,
// and pbeta(0.1, 1e308, 1e308) and pbeta(0.9, 1e308, 1e308) were NaN. R 4.5.2 gives 0 and 1 (log -Inf and -0).
// The logs: Rmpfr's log of x^a (1 - x)^b / (a B(a, b)), printed with sprintf("%a") (the other factors move it by
// less than an ulp).
import { describe, expect, it } from "vitest";
import { pbeta } from "../src/index.js";

function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

describe("issue #491", () => {
  it("the issue's example is 0, as before", () => {
    expect(pbeta(0.1, 1e308, 5e307)).toBe(0);
    expect(pbeta(0.1, 1e308, 5e307, { lowerTail: false })).toBe(1);
  });

  it("tails away from the mean where a + b overflows: 0 and 1 as R", () => {
    for (const [x, a, b] of [
      [0.0025, 1e308, 1e308],
      [0.1, 1e308, 1e308],
      [0.1, 9e307, 9e307],
      [0.5, 1.7e308, 1e307],
    ]) {
      expect(pbeta(x!, a!, b!)).toBe(0);
      expect(pbeta(x!, a!, b!, { lowerTail: false })).toBe(1);
      expect(pbeta(x!, a!, b!, { lowerTail: false, logP: true })).toBe(0);
    }
    expect(pbeta(0.9, 1e308, 1e308)).toBe(1);
    expect(pbeta(0.9, 1e308, 1e308, { lowerTail: false })).toBe(0);
    expect(pbeta(0.9, 1e308, 1e308, { logP: true })).toBe(0);
  });

  it("the logs of the small tails (R: -Inf)", () => {
    expect(pbeta(0.1, 1e308, 1e308, { logP: true })).toBe(fromHex("-0x1.22f9d6cd6a1e6p+1023"));
    expect(pbeta(0.9, 1e308, 1e308, { lowerTail: false, logP: true })).toBe(fromHex("-0x1.22f9d6cd6a1e8p+1023"));
    expect(pbeta(0.1, 9e307, 9e307, { logP: true })).toBe(fromHex("-0x1.05e0daec12b4fp+1023"));
    expect(pbeta(0.5, 1.7e308, 1e307, { logP: true })).toBe(fromHex("-0x1.eab3f90c71752p+1022"));
    // beyond the doubles: a log x alone is below -1.8e308
    expect(pbeta(0.0025, 1e308, 1e308, { logP: true })).toBe(-Infinity);
  });
});
