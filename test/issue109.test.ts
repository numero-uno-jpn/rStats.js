// Issue #109: dlogis with a huge finite scale, where scale (1 + e)^2 overflowed and the density, a subnormal, was 0
// (review_fix_log_issue109.md). R 4.5.2: 0, and -Inf on the log scale.
import { describe, expect, it } from "vitest";
import { dlogis } from "../src/index.js";

const MIN = Number.MIN_VALUE;
const scale = 1.282987806042392e308;

describe("issue #109", () => {
  it("gives the subnormal density where the denominator overflows", () => {
    for (const x of [scale / 2, 0, -scale / 3]) {
      const v = dlogis(x, { scale });
      // the density of x / 16 at scale / 16 (in the normal range), divided by 16: one rounding onto the subnormals
      const want = dlogis(x / 16, { scale: scale / 16 }) / 16;
      expect(v, String(x)).toBeGreaterThan(0);
      expect(Math.abs(v - want), String(x)).toBeLessThanOrEqual(MIN);
      // and the log scale agrees (exp of a log near -711 is off by about 30 subnormal units)
      expect(Math.abs(Math.log(v) - dlogis(x, { scale, log: true })), String(x)).toBeLessThan(1e-11);
    }
    expect(Math.abs(dlogis(0, { scale }) - 1 / 4 / scale)).toBeLessThanOrEqual(MIN);
  });

  it("keeps the ordinary scales", () => {
    expect(dlogis(0.5)).toBe(Math.exp(-0.5) / (1 + Math.exp(-0.5)) ** 2);
    expect(dlogis(1, { scale: 1e300 })).toBe(dlogis(1e-300) / 1e300);
  });
});
