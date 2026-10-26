// p-value adjustment for multiple comparisons (R's p.adjust).
//
// Formulas from the papers: Holm (1979), Hochberg (1988), Bonferroni, Benjamini & Hochberg (1995),
// Benjamini & Yekutieli (2001). The notion of adjusted p-values follows Wright (1992).
// The Hommel (1988) adjusted p-value procedure is the same as statsmodels multipletests (method = "hommel")
// (statsmodels/stats/multitest.py; statsmodels commit 5c65604, BSD-3-Clause, see THIRD_PARTY_NOTICES.md).
// NaN handling, how n is counted and the order of multiplications (which affects rounding) follow R's output.
// - NaN values are excluded from the adjustment and returned as NaN in place. n defaults to the number of non-NaN p
// - n must be at least the number of non-NaN p, otherwise an error. With n <= 1 no adjustment is made
// - When n exceeds the number of p, the unobserved p are treated as "larger than any observed" for Bonferroni and Holm,
//   and as 1 otherwise (Hommel adds them as 1 in the computation)
// - p outside [0, 1] is computed as is, like R (capped at 1 above, not bounded below)
// Differences from R: with Hommel, a non-integer n is an error (R silently returns something). For a length-0 p
// with Hommel and n > 0, R returns a length-1 value; here a length-0 result is returned

import { sum } from "../internal/summary.js";

/**
 * Adjustment method for {@link pAdjust}, as in R's `p.adjust.methods`. `"fdr"` is an alias of `"BH"`.
 *
 * @category Multiple comparisons
 */
export type PAdjustMethod = "holm" | "hochberg" | "hommel" | "bonferroni" | "BH" | "BY" | "fdr" | "none";

/**
 * Options for {@link pAdjust}.
 *
 * @category Multiple comparisons
 */
export interface PAdjustOptions {
  /** Adjustment method. Default `"holm"`. Unambiguous abbreviations are accepted, as in R. */
  method?: PAdjustMethod | (string & {});
  /**
   * Number of comparisons. Default: the number of non-`NaN` p-values. Must not be smaller
   * than that; must be an integer for `"hommel"`.
   */
  n?: number;
}

const METHODS: PAdjustMethod[] = ["holm", "hochberg", "hommel", "bonferroni", "BH", "BY", "fdr", "none"];

function matchMethod(m: string): PAdjustMethod {
  if ((METHODS as string[]).includes(m)) return m as PAdjustMethod;
  const hit = METHODS.filter((v) => v.startsWith(m));
  if (m.length === 0 || hit.length !== 1) throw new RangeError(`invalid method "${m}"`);
  return hit[0]!;
}

/**
 * Adjusts p-values for multiple comparisons. Equivalent to R's `p.adjust()`.
 *
 * `NaN` values are excluded from the adjustment and returned as `NaN` in place. If `n` is
 * 1 or less, the p-values are returned unchanged. Differences from R: with `"hommel"` a
 * non-integer `n` is an error, and an empty `p` always gives an empty result.
 *
 * @param p p-values.
 * @param options See {@link PAdjustOptions}, or just the method name as a string.
 * @returns Adjusted p-values, in the same order as `p`.
 *
 * @example
 * ```ts
 * const p = [0.01, 0.02, 0.03, 0.04, 0.05];
 * pAdjust(p);       // [0.05, 0.08, 0.09, 0.09, 0.09] (Holm)
 * pAdjust(p, "BH"); // [0.05, 0.05, 0.05, 0.05, 0.05]
 * pAdjust(p, { method: "bonferroni", n: 10 });
 * ```
 *
 * @category Multiple comparisons
 */
export function pAdjust(
  p: readonly number[] | Float64Array,
  options: PAdjustOptions | PAdjustMethod | (string & {}) = {},
): number[] {
  const opts: PAdjustOptions = typeof options === "string" ? { method: options } : options;
  const method = matchMethod(opts.method ?? "holm");
  const all = Array.from(p);
  const idx: number[] = [];
  for (let i = 0; i < all.length; i++) if (!Number.isNaN(all[i]!)) idx.push(i);
  const lp = idx.length;
  const n = opts.n ?? lp;
  if (!(n >= lp)) throw new RangeError("n must be at least the number of non-NaN p-values");
  if (n <= 1) return all;
  const pv = idx.map((i) => all[i]!);
  const adj = adjust(pv, method, n);
  const out = all.slice();
  idx.forEach((i, k) => (out[i] = adj[k]!));
  return out;
}

/** Stable sort indices (equal values keep their original order) */
function order(p: readonly number[], decreasing: boolean): number[] {
  const o = p.map((_, i) => i);
  o.sort((a, b) => (decreasing ? p[b]! - p[a]! : p[a]! - p[b]!) || a - b);
  return o;
}

function adjust(p: readonly number[], method: PAdjustMethod, n: number): number[] {
  const lp = p.length;
  const out = new Array<number>(lp);
  switch (method) {
    case "none":
      return p.slice();
    case "bonferroni":
      return p.map((v) => Math.min(1, n * v));
    case "holm": {
      // Cumulative maximum of (n - i + 1) p_(i) in increasing order
      const o = order(p, false);
      let m = -Infinity;
      o.forEach((j, k) => {
        m = Math.max(m, (n - k) * p[j]!);
        out[j] = Math.min(1, m);
      });
      return out;
    }
    case "hochberg": {
      // Cumulative minimum of (n - i + 1) p_(i) in decreasing order (i is the rank in increasing order)
      const o = order(p, true);
      let m = Infinity;
      o.forEach((j, k) => {
        const i = lp - k;
        m = Math.min(m, (n - i + 1) * p[j]!);
        out[j] = Math.min(1, m);
      });
      return out;
    }
    case "BH":
    case "fdr":
    case "BY": {
      // Cumulative minimum of (n / i) p_(i) in decreasing order. BY additionally multiplies by sum_{k=1}^{n} 1/k
      // (evaluated as q * n / i * p, which rounds the same way as R)
      // (R's sum accumulates in extended precision, so the sum is taken in double-double)
      const q = method === "BY" ? sum(Array.from({ length: Math.floor(n) }, (_, k) => 1 / (k + 1))) : 1;
      const o = order(p, true);
      let m = Infinity;
      o.forEach((j, k) => {
        const i = lp - k;
        m = Math.min(m, ((q * n) / i) * p[j]!);
        out[j] = Math.min(1, m);
      });
      return out;
    }
    case "hommel":
      return hommel(p, n);
  }
}

/**
 * Hommel adjusted p-values (the hommel procedure of statsmodels multipletests).
 * The n - lp unobserved p are added as 1. O(n^2)
 */
function hommel(p: readonly number[], n: number): number[] {
  if (!Number.isInteger(n)) throw new RangeError("n must be an integer for the hommel method");
  const lp = p.length;
  const full = [...p, ...new Array<number>(n - lp).fill(1)];
  const o = order(full, false);
  const s = o.map((j) => full[j]!);
  const a = s.slice();
  for (let m = n; m >= 2; m--) {
    // Simes value from the largest m: min_k m p_(n-m+k) / k
    let cim = Infinity;
    for (let k = 1; k <= m; k++) cim = Math.min(cim, (m * s[n - m + k - 1]!) / k);
    for (let i = n - m; i < n; i++) a[i] = Math.max(a[i]!, cim);
    for (let i = 0; i < n - m; i++) a[i] = Math.max(a[i]!, Math.min(m * s[i]!, cim));
  }
  const out = new Array<number>(lp);
  o.forEach((j, k) => {
    if (j < lp) out[j] = a[k]!;
  });
  return out;
}
