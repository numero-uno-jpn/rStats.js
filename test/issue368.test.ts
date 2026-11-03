// Issue #368: with a shape of about 1e307 and above, x / scale can exceed the largest double although the gamma
// quantile or log upper tail is finite. qgamma's search stopped at Number.MAX_VALUE (qgamma(-1e308, 1e308, scale 1e-308,
// upper, log) was 1.797, the true value about 3.146) and pgamma saw x = Inf (log upper tail -Inf, true about -1e308).
// User decision (2026-11-03): NaN in that range instead of a wrong value; where scale >= 1 the quantile is Inf (R too).
import { describe, expect, it } from "vitest";
import { pgamma, qgamma } from "../src/distributions/gamma.js";

const up = { lowerTail: false, logP: true };

describe("issue #368: gamma beyond the largest standardized x", () => {
  it("qgamma: NaN where the standardized quantile is beyond MAX_VALUE and scale < 1, Inf for scale >= 1", () => {
    expect(qgamma(-1e308, 1e308, { scale: 1e-308, ...up })).toBeNaN();
    expect(qgamma(-1e308, 1e308, { scale: 0.9, ...up })).toBeNaN();
    // R 4.5.2: Inf (it was MAX_VALUE)
    expect(qgamma(-1e308, 1e308, { scale: 1, ...up })).toBe(Infinity);
  });

  it("pgamma: NaN for the log upper tail where q / scale overflows and the value is finite", () => {
    expect(pgamma(3.146, 1e308, { scale: 1e-308, ...up })).toBeNaN();
    expect(pgamma(1.8, 1e308, { scale: 1e-308, ...up })).toBeNaN();
  });

  it("keeps the other values", () => {
    expect(qgamma(-1e300, 1e308, { scale: 1e-308, ...up })).toBe(1.0001414280229826);
    expect(qgamma(-1e308, 1e307, { scale: 1e-307, ...up })).toBe(13.610868638149874);
    expect(qgamma(0.5, 1e308, { scale: 1e-308 })).toBe(0.9999999999999999);
    expect(pgamma(1.7, 1e308, { scale: 1e-308, ...up })).toBe(-1.6937174893782966e307);
    // the other tails where q / scale overflows are right (1, 0, 0) and so is log Q = -Inf where it overflows
    expect(pgamma(1.8, 1e308, { scale: 1e-308 })).toBe(1);
    expect(pgamma(1.8, 1e308, { scale: 1e-308, logP: true })).toBe(0);
    expect(pgamma(1.8, 1e308, { scale: 1e-308, lowerTail: false })).toBe(0);
    expect(pgamma(1e308, 1, { scale: 1e-10, ...up })).toBe(-Infinity);
    expect(pgamma(1e308, 1e300, { scale: 0.5, ...up })).toBe(-Infinity);
  });
});
