// Issue #136: qt with a huge ncp. The issue's example was already finite and correct; a quantile beyond the largest
// double returned 1 (or another finite value) instead of Infinity.
import { describe, expect, it } from "vitest";
import { pt, qt } from "../src/index.js";

describe("issue #136", () => {
  it("a quantile beyond the largest double is Infinity", () => {
    // pt(1.7e308, 2, ncp = 1e308) = 0.7075 < 0.9. Before: 1 (pt 0 there) or 2.2844135865397565e222; R: Inf
    expect(pt(1.7e308, 2, { ncp: 1e308 })).toBeLessThan(0.9);
    expect(qt(0.9, 2, { ncp: 6e307 })).toBe(Infinity);
    expect(qt(0.9, 2, { ncp: 1e308 })).toBe(Infinity);
    expect(qt(0.95, 2, { ncp: 5e307 })).toBe(Infinity);
    expect(qt(0.5, 2, { ncp: 1.5e308 })).toBe(Infinity);
    expect(qt(0.9, 1, { ncp: 1e308 })).toBe(Infinity);
    expect(qt(0.99, 10, { ncp: 1e308 })).toBe(Infinity);
    // the far upper tail where ncp^2 / df overflows, and the mirror image
    expect(qt(1e-300, 2, { ncp: 1e299, lowerTail: false })).toBe(Infinity);
    expect(qt(1e-10, 2, { ncp: 1e299, lowerTail: false })).toBe(9.999999999749997e303);
    expect(qt(0.5, 0.01, { ncp: 1e299 })).toBe(Infinity);
    expect(qt(0.1, 2, { ncp: -1e308 })).toBe(-Infinity);
    expect(qt(0.5, 0.01, { ncp: 1.7e308, lowerTail: false })).toBe(Infinity);
  });

  it("finite quantiles as before", () => {
    // the issue's example (R: Inf)
    expect(qt(0.9, 2, { ncp: 1e299 })).toBe(3.0807826247611014e299);
    expect(qt(0.1, 2, { ncp: 1e299 })).toBe(6.5901022898226085e298);
    expect(qt(0.5, 2, { ncp: 1e299 })).toBe(1.2011224087864497e299);
    expect(qt(0.9, 1, { ncp: 1e299 })).toBe(7.957896561090548e299);
    expect(qt(0.9, 10, { ncp: 1e299 })).toBe(1.433674141138895e299);
    expect(qt(0.9, 2, { ncp: 1e200 })).toBe(3.0807826247611006e200);
    expect(qt(0.1, 2, { ncp: 1e308 })).toBe(6.590102289822609e307);
    expect(qt(0.9, 2, { ncp: 5e307 })).toBe(1.5403913123805503e308);
  });
});
