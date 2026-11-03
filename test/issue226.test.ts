// Issue #226: mantelhaenTest (2 x 2 x K) where the stratum totals or the sums over the strata overflow
// (review_fix_log_issue226.md).
import { describe, expect, it } from "vitest";
import { mantelhaenTest } from "../src/index.js";

const t = [[1e308, 1e308], [1e308, 1e308]];
const u1 = [[1e308, 5e307], [3e307, 1e308]];
const u2 = [[4e307, 1e308], [2e307, 6e307]];

describe("issue #226: mantelhaenTest, 2 x 2 x K with overflowing totals", () => {
  it("gives 0 and the odds ratio 1 for balanced strata (was NaN; R fails)", () => {
    const r = mantelhaenTest([t, t]);
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.estimate).toBe(1);
    // the sd of log(estimate) is near 1e-154, so the limits round to 1
    expect(r.confInt).toEqual([1, 1]);
  });

  it("matches exact arithmetic for unbalanced strata", () => {
    // Rmpfr (300 bits) on the doubles: statistic 0x1.ae2150376cad2p+1021 (with or without the correction 1/2 at
    // this precision), common odds ratio 0x1.9d0d3b4101b9dp+1
    const stat = 3.7755956165032904e307;
    const or = 3.2269662921348314;
    for (const correct of [true, false]) {
      const r = mantelhaenTest([u1, u2], { correct });
      expect(Math.abs(r.statistic / stat - 1)).toBeLessThan(2e-15);
      expect(r.pValue).toBe(0);
      expect(Math.abs((r.estimate as number) / or - 1)).toBeLessThan(5e-16);
    }
    const g = mantelhaenTest([u1, u2], { alternative: "greater" });
    expect(g.pValue).toBe(0);
    expect(g.confInt?.[1]).toBe(Infinity);
  });

  it("keeps the values where nothing overflows", () => {
    const r = mantelhaenTest([
      [[1e150, 1e150], [1e150, 1e150]],
      [[1e150, 1e150], [1e150, 1e150]],
    ]);
    expect(r.statistic).toBe(0);
    expect(r.confInt).toEqual([1, 1]);
    const s = mantelhaenTest([
      [[10, 5], [4, 12]],
      [[8, 6], [5, 9]],
      [[12, 4], [6, 10]],
    ]);
    expect(s.statistic).toBe(8.972595458903124);
    expect(s.estimate).toBe(4.13218122372723);
  });
});
