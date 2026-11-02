// Issue #138: the far-tail power law of qt with ncp returned Infinity for log |t| > 709.78, below the log of the largest
// double (709.7827), so quantiles in (1.7928e308, 1.7977e308] were lost (review_fix_log_issue138.md). Reference: for
// df = 2, P[T > t] = c / t² (1 + O(1/t²)) with c = (1 + δ²) Φ(δ) + δ φ(δ); R:
// log(c) - 2 * log(.Machine$double.xmax) is the log probability whose quantile is the largest double. (The issue's
// example with ncp = 0 is right: it is 1.27e308, as P[T > t] = 1/(2 t²) there.)
import { describe, expect, it } from "vitest";
import { qt } from "../src/index.js";

const MAX = Number.MAX_VALUE;
const upperLog = { lowerTail: false, logP: true };

describe("issue #138", () => {
  it("keeps quantiles just below the largest double", () => {
    for (const [ncp, lp] of <[number, number][]>[
      [0.5, -1419.5258582683982],
      [3, -1417.2628610374888],
      [-0.5, -1421.1277928215623],
      [1e-300, -Math.LN2 - 2 * Math.log(MAX)],
    ]) {
      const q = qt(lp, 2, { ncp, ...upperLog }) as number;
      expect(q).toBeLessThan(Infinity);
      expect(Math.abs(q / MAX - 1)).toBeLessThan(1e-12);
      // log |t| = 709.781 (between the old cutoff 709.78 and the largest double)
      const r = qt(lp + 2 * (Math.log(MAX) - 709.781), 2, { ncp, ...upperLog }) as number;
      expect(Math.abs(Math.log(r) - 709.781)).toBeLessThan(1e-12);
      // beyond the largest double the quantile is Infinity
      expect(qt(lp - 1e-6, 2, { ncp, ...upperLog })).toBe(Infinity);
    }
  });

  it("keeps the other cases as before", () => {
    expect(qt(-1419.565225786768, 2, { ncp: 0, ...upperLog })).toBe(1.2710338964086606e308);
    expect(qt(-1419.565225786768, 2, { ncp: -0.5, ...upperLog })).toBe(8.230163055410909e307);
  });
});
