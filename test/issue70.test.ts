// Issue #70: seq with finite ends whose difference overflows (review_fix_log_issue70.md).
import { describe, expect, it } from "vitest";
import { seq } from "../src/index.js";

describe("issue #70", () => {
  it("interpolates with lengthOut (the interior values were NaN)", () => {
    expect(seq(-1e308, 1e308, { lengthOut: 3 })).toEqual([-1e308, 0, 1e308]); // R 4.5.2: the same
    expect(seq(-1e308, 1e308, { lengthOut: 5 })).toEqual([-1e308, -5e307, 0, 5e307, 1e308]); // R: -5.0000000000000009e307
    // the interior values are those of the halved ends, doubled
    const half = seq(0.85e308, -0.85e308, { lengthOut: 4 }).map((v) => 2 * v);
    expect(seq(1.7e308, -1.7e308, { lengthOut: 4 })).toEqual(half);
  });

  it("steps by `by` (an error before)", () => {
    expect(seq(-1e308, 1e308, { by: 1e308 })).toEqual([-1e308, 0, 1e308]); // R 4.5.2: the same
    expect(seq(-1e308, 1e308, { by: 5e307 })).toEqual([-1e308, -5e307, 0, 5e307, 1e308]); // R: the middle -1.996e292
    expect(seq(1e308, -1e308, { by: -1e308 })).toEqual([1e308, 0, -1e308]);
    // 1e308 / 1e302 is 1999999.9999999998 in doubles: 2e6 values, as for the halved ends
    const s = seq(-1e308, 1e308, { by: 1e302 });
    const h = seq(-0.5e308, 0.5e308, { by: 0.5e302 });
    expect(s.length).toBe(h.length);
    expect(s[1000000]).toBe(2 * h[1000000]!);
    expect(s[s.length - 1]).toBe(2 * h[h.length - 1]!);
    expect(() => seq(-1e308, 1e308, { by: -1e308 })).toThrow(RangeError);
  });

  it("gives the same values as for halved ends, doubled", () => {
    const a = seq(-0.5e308, 0.5e308, { by: 0.3e308 }).map((v) => 2 * v);
    expect(seq(-1e308, 1e308, { by: 0.6e308 })).toEqual(a.map((v) => Math.min(v, 1e308)));
  });
});
