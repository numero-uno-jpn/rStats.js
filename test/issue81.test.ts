// Issue #81: pretty's interior break points where the range U - L overflows (review_fix_log_issue81.md).
import { describe, expect, it } from "vitest";
import { pretty } from "../src/index.js";

// break points j * unit for j = s..t, each within 1e-14 of the unit, finite and strictly increasing, with the ends
// exact (R 4.5.2 gives finite, increasing points for all of these)
function expectGrid(x: number[], n: number, s: number, t: number, unit: number, ends: [number, number]) {
  const out = pretty(x, { n });
  expect(out).toHaveLength(t - s + 1);
  expect(out[0]).toBe(ends[0]);
  expect(out.at(-1)).toBe(ends[1]);
  out.forEach((v, i) => {
    expect(Number.isFinite(v), `point ${i}`).toBe(true);
    if (i > 0) expect(v, `point ${i}`).toBeGreaterThan(out[i - 1]!);
    expect(Math.abs(v - (s + i) * unit), `point ${i}`).toBeLessThan(1e-14 * unit);
  });
  expect(out[-s]).toBe(0);
}

describe("issue #81", () => {
  it("keeps the interior points finite when U - L overflows", () => {
    // the issue's example: 18 * 1e307 overflowed, giving Infinity at points 18 and 19
    expectGrid([-1e308, 1e308], 20, -10, 10, 1e307, [-1e308, 1e308]);
    expectGrid([-1e308, 1.7e308], 50, -20, 34, 5e306, [-1e308, 1.7e308]);
  });

  it("keeps the interior points finite for ends kept at the data (seqLength in half coordinates)", () => {
    // the multiples of the unit overflow, so the ends are the data and the points are seq(L, U, length = 7)
    const out = pretty([-1.7e308, 1.7e308], { n: 10 });
    expect(out).toHaveLength(7);
    expect(out[0]).toBe(-1.7e308);
    expect(out[6]).toBe(1.7e308);
    expect(out[3]).toBe(0);
    out.forEach((v, i) => {
      expect(Number.isFinite(v), `point ${i}`).toBe(true);
      expect(Math.abs(v - ((i - 3) / 3) * 1.7e308), `point ${i}`).toBeLessThan(1e-14 * 1.7e308);
    });
  });

  it("leaves the ordinary range unchanged", () => {
    expect(pretty([0.3, 9.6])).toEqual([0, 2, 4, 6, 8, 10]);
    expect(pretty([-1e308, 1e308], { n: 5 })).toEqual([-1e308, -5e307, 0, 5e307, 1e308]);
  });
});
