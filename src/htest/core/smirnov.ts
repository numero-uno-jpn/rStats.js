// Exact distribution of the two-sample Kolmogorov-Smirnov (Smirnov) statistic, for ks.test.
//
// Written for rStats.js from the published method (no ported code). Under the null hypothesis every arrangement of
// the m + n pooled observations is equally likely, i.e. every lattice path from (0, 0) to (m, n) (i steps for x,
// j steps for y). The statistic is the largest |i/m - j/n| (two-sided) or i/m - j/n ("greater") or j/n - i/m ("less")
// over the points where it can be observed: after every observation without ties, and only where the pooled sorted
// sample changes value when there are ties (Schröer and Trenkler, Computational Statistics & Data Analysis 20, 1995).
//
// P(D >= d) is summed over the points where a path first reaches the boundary: with v(i, j) the fraction of paths
// to (i, j) that stay inside,
//   v(i, j) = i/(i+j) v(i-1, j) + j/(i+j) v(i, j-1),
// and a path through a boundary point is counted with the probability dhyper(i; m, n, i + j) of passing it. All
// terms are positive, so small p-values keep their relative accuracy (1 - P(D < d) would lose them).

import { dhyper1 } from "../../distributions/hypergeometric.js";

export type SmirnovAlternative = "two.sided" | "less" | "greater";

export interface SmirnovOptions {
  /** Which statistic: max |F_x - F_y| ("two.sided", default), max (F_x - F_y) ("greater"), max (F_y - F_x) ("less"). */
  alternative?: SmirnovAlternative;
  /**
   * The pooled sample (length m + n). With ties, the statistic is only observed where the sorted values change.
   * Omit for continuous data without ties.
   */
  z?: readonly number[];
}

/**
 * P(D >= d) for the two-sample Smirnov statistic with sample sizes m and n, exactly.
 * The comparison D >= d is done on the integer scale |i n - j m| >= d m n with a relative fuzz of 1e-10, so that a
 * statistic computed in floating point from the data is not lost to rounding.
 *
 * @param d - Value of the statistic.
 * @param m - Size of the first sample (x).
 * @param n - Size of the second sample (y).
 */
export function psmirnovUpper(d: number, m: number, n: number, options: SmirnovOptions = {}): number {
  const alternative = options.alternative ?? "two.sided";
  if (Number.isNaN(d) || !(m >= 1) || !(n >= 1) || m !== Math.floor(m) || n !== Math.floor(n)) return NaN;
  if (d <= 0) return 1;
  if (d > 1) return 0;
  // where the statistic is observed: after step s = i + j (1..m+n-1), or only where z changes
  const N = m + n;
  let observed: boolean[] | undefined;
  if (options.z !== undefined) {
    if (options.z.length !== N) throw new RangeError("z must have length m + n");
    const zs = [...options.z].sort((a, b) => a - b);
    observed = new Array<boolean>(N + 1).fill(false);
    for (let s = 1; s < N; s++) observed[s] = zs[s]! !== zs[s - 1]!;
  }
  const threshold = d * m * n * (1 - 1e-10);
  const crosses = (i: number, j: number): boolean => {
    const diff = i * n - j * m;
    const v = alternative === "two.sided" ? Math.abs(diff) : alternative === "greater" ? diff : -diff;
    return v >= threshold;
  };
  // v over j for the current i (rolling row)
  let prev = new Float64Array(n + 1);
  let cur = new Float64Array(n + 1);
  let p = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) {
        cur[0] = 1;
        continue;
      }
      const s = i + j;
      const reach = (i > 0 ? (i / s) * prev[j]! : 0) + (j > 0 ? (j / s) * cur[j - 1]! : 0);
      const obs = observed === undefined ? s < N : observed[s]!;
      if (obs && crosses(i, j)) {
        if (reach > 0) p += reach * dhyper1(i, m, n, s, false);
        cur[j] = 0;
      } else {
        cur[j] = reach;
      }
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return Math.min(p, 1);
}
