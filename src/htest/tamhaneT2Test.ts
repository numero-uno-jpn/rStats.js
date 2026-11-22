// Tamhane's T2 and T2' all-pairs comparisons (Tamhane, JASA 74, 1979).
// The formulas are implemented independently from the equations and public-output checks in
// oracle/tamhane-behaviour.md; no PMCMRplus implementation or source-derived material is used.

import { pt } from "../distributions/t.js";
import { groupMoments, satterthwaiteDfPM } from "../internal/summary.js";
import type { GroupLabel } from "./groups.js";
import type { Sample } from "./types.js";

export interface TamhaneT2Options {
  /** Welch–Satterthwaite df for T2 (true), or n_i + n_j - 2 for T2' (false). Default true. */
  welch?: boolean;
}

export interface TamhaneT2Result {
  method: string;
  statistic: number[][];
  pValue: number[][];
  rowNames: string[];
  colNames: string[];
  pAdjustMethod: "T2 (Sidak)";
  dist: "t";
  alternative: "two.sided";
  warnings: string[];
}

/** Group observations in order of first appearance; missing observations and missing labels are omitted. */
function groupsInOrder(x: Sample | readonly Sample[], g?: readonly GroupLabel[]): { labels: string[]; groups: number[][] } {
  if (g === undefined) {
    const list = x as readonly Sample[];
    if (list.length === 0 || typeof list[0] === "number") throw new TypeError("'g' is required when 'x' is a single sample");
    const groups: number[][] = [];
    const labels: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const values = Array.from(list[i]!).filter((v) => !Number.isNaN(v));
      if (values.some((v) => !Number.isFinite(v))) throw new RangeError("all observations must be finite");
      if (values.length > 0) {
        groups.push(values);
        labels.push(String(i + 1));
      }
    }
    return { labels, groups };
  }
  const values = Array.from(x as Sample);
  if (values.length !== g.length) throw new RangeError("'x' and 'g' must have the same length");
  const byLabel = new Map<string, number[]>();
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    const label = g[i]!;
    if (typeof label === "number" && !Number.isFinite(label)) continue;
    if (Number.isNaN(v)) continue;
    if (!Number.isFinite(v)) throw new RangeError("all observations must be finite");
    const key = String(label);
    let group = byLabel.get(key);
    if (group === undefined) byLabel.set(key, (group = []));
    group.push(v);
  }
  return { labels: [...byLabel.keys()], groups: [...byLabel.values()] };
}

/**
 * Tamhane's T2 (Welch–Satterthwaite df) or T2' (pooled df) all-pairs comparison.
 *
 * Character labels are treated as factor levels in their first-appearance order. Missing observations are omitted.
 * The lower-triangular statistic and p-value matrices compare each row group with each column group.
 *
 * @param x Observations, or a list of samples (one per group).
 * @param g Group labels parallel to x; omit for a list of samples.
 * @param options Set `welch: false` for T2'.
 * @returns Pairwise t statistics and Šidák-adjusted two-sided probabilities.
 *
 * @category Multiple comparisons
 */
export function tamhaneT2Test(
  x: Sample | readonly Sample[],
  g?: readonly GroupLabel[],
  options: TamhaneT2Options = {},
): TamhaneT2Result {
  const welch = options.welch ?? true;
  const d = groupsInOrder(x, g);
  const k = d.groups.length;
  if (k < 2) throw new RangeError("there must be at least two groups");
  const gm = groupMoments(d.groups);
  const m = k * (k - 1) / 2;
  const statistic = Array.from({ length: k - 1 }, () => new Array<number>(k - 1).fill(NaN));
  const pValue = Array.from({ length: k - 1 }, () => new Array<number>(k - 1).fill(NaN));
  for (let i = 1; i < k; i++) {
    for (let j = 0; j < i; j++) {
      const ni = gm.n[i]!;
      const nj = gm.n[j]!;
      if (ni < 2 || nj < 2) continue;
      const vi = gm.variance[i]!;
      const vj = gm.variance[j]!;
      const a = vi / ni;
      const b = vj / nj;
      const se = Math.sqrt(a + b);
      const t = (gm.mean[i]! - gm.mean[j]!) / se;
      const df = welch ? satterthwaiteDfPM([vi, vj], [ni, nj]) : ni + nj - 2;
      const raw = 2 * pt(Math.abs(t), df, { lowerTail: false });
      const adjusted = raw >= 1 ? 1 : -Math.expm1(m * Math.log1p(-raw));
      statistic[i - 1]![j] = t;
      pValue[i - 1]![j] = adjusted;
    }
  }
  return {
    method: welch ? "Tamhane's T2-test for unequal variances" : "Tamhane's T2'-test for unequal variances",
    statistic,
    pValue,
    rowNames: d.labels.slice(1),
    colNames: d.labels.slice(0, -1),
    pAdjustMethod: "T2 (Sidak)",
    dist: "t",
    alternative: "two.sided",
    warnings: [],
  };
}
