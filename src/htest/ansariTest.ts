// Ansari-Bradley two-sample test of scale (R's ansari.test, without the optional confidence interval).
//
// Written for rStats.js from the published test (Ansari and Bradley, Ann. Math. Stat. 31, 1960; no ported code).
// Scores min(r, N + 1 - r) of the pooled ranks r (average ranks for ties); the statistic is the sum over the first
// sample. Small samples without ties use the exact null distribution (src/htest/core/ansari.ts); the two-sided
// p-value doubles the smaller tail. Otherwise the statistic is standardised and compared with the normal, with Ansari
// and Bradley's mean and the variance of a linear rank statistic from the observed sum of squared scores (the form
// scipy.stats.ansari also uses).

import { pnorm } from "../distributions/normal.js";
import { rank } from "../internal/summary.js";
import { pansariExact } from "./core/ansari.js";
import { matchAlternative, type Alternative, type HTest, type Sample } from "./types.js";

/** Options for {@link ansariTest}. */
export interface AnsariTestOptions {
  /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Exact p-value. Default: exact when both samples have fewer than 50 values and there are no ties. */
  exact?: boolean;
}

/**
 * Ansari-Bradley test that two samples differ in scale. Equivalent to R's `ansari.test()` (without `conf.int`).
 * `NaN` values are dropped.
 */
export function ansariTest(x: Sample, y: Sample, options: AnsariTestOptions = {}): HTest {
  const xs = Array.from(x).filter((v) => !Number.isNaN(v));
  const ys = Array.from(y).filter((v) => !Number.isNaN(v));
  const m = xs.length;
  const n = ys.length;
  if (m < 1) throw new RangeError("not enough 'x' observations");
  if (n < 1) throw new RangeError("not enough 'y' observations");
  const alternative = matchAlternative(options.alternative);
  const N = m + n;
  const r = rank(xs.concat(ys));
  const a = r.map((v) => Math.min(v, N - v + 1));
  let statistic = 0;
  for (let i = 0; i < m; i++) statistic += a[i]!;
  const ties = new Set(r).size < N;
  const exact = options.exact ?? (m < 50 && n < 50 && !ties);

  let pValue: number;
  if (exact && !ties) {
    const upperFrom = (q: number): number => pansariExact(q - 1, m, n, false); // P(AB >= q)
    const lowerTo = (q: number): number => pansariExact(q, m, n, true); // P(AB <= q)
    if (alternative === "two.sided") {
      // the smaller tail, judged by the position of the statistic against the centre of the distribution
      const centre = Math.floor((m + 1) ** 2 / 4) + Math.floor((m * n) / 2) / 2;
      pValue = Math.min(1, 2 * (statistic > centre ? upperFrom(statistic) : lowerTo(statistic)));
    } else if (alternative === "less") pValue = upperFrom(statistic);
    else pValue = lowerTo(statistic);
  } else {
    // mean and variance with the sum of the scores at its value without ties (N (N + 2) / 4 for even N,
    // (N + 1)^2 / 4 for odd N), and the sum of their squares as observed
    let sq = 0;
    for (const v of a) sq += v * v;
    const even = N % 2 === 0;
    const mean = even ? (m * (N + 2)) / 4 : (m * (N + 1) ** 2) / (4 * N);
    const variance = even
      ? (m * n * (16 * sq - N * (N + 2) ** 2)) / (16 * N * (N - 1))
      : (m * n * (16 * N * sq - (N + 1) ** 4)) / (16 * N * N * (N - 1));
    const z = (statistic - mean) / Math.sqrt(variance);
    // large AB means the first sample is concentrated in the middle: smaller scale
    pValue =
      alternative === "two.sided"
        ? 2 * Math.min(pnorm(z), pnorm(z, { lowerTail: false }))
        : alternative === "less"
          ? pnorm(z, { lowerTail: false })
          : pnorm(z);
  }
  return { method: "Ansari-Bradley test", alternative, statistic, statisticName: "AB", pValue };
}
