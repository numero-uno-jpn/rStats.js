// Grouped data for the k-sample tests: either an array of samples (R's list form) or a sample with a parallel array
// of group labels (R's x, g form). Pairs with a missing value or label are dropped, and groups are kept in order
// of the sorted labels (as R orders factor levels). Numeric labels with the same 15-digit text are one group, as in
// R's factor() (src/internal/levels.ts); the group's label is the smallest of them, written as R writes it
// ("1e+15", "0.333333333333333"). When the labels mix numbers and strings, all are text, as R coerces such a vector
// to character (2 and "2" are one group); levels are then ordered by code point.

import { levelText, numberLevels } from "../internal/levels.js";
import { compareCodePoints } from "../models/modelFrame.js";
import type { Sample } from "./types.js";
import { midpoint } from "../internal/extremes.js";

/**
 * Group label: a number or a string.
 *
 * @category Hypothesis tests
 */
export type GroupLabel = number | string;

/**
 * Labels as R's factor() takes them: numbers with the same 15-digit text as one (numberLevels), and all as text when
 * any label is a string (R coerces a mixed vector to character). NaN stays missing
 */
export function factorLabels(g: readonly GroupLabel[]): GroupLabel[] {
  const gs = numberLevels(g);
  if (!gs.some((l) => typeof l === "string")) return gs;
  return gs.map((l) => (typeof l === "number" && !Number.isNaN(l) ? levelText(l) : l));
}

/** Order of levels (of one type after factorLabels): numbers numerically, strings by code point (C locale) */
export function compareLabels(a: GroupLabel, b: GroupLabel): number {
  return typeof a === "number" && typeof b === "number" ? a - b : compareCodePoints(String(a), String(b));
}

/** Groups with their labels: the sorted labels (x, g form) or the 1-based positions in the list (list form) */
export interface LabelledGroups {
  labels: string[];
  groups: number[][];
}

/**
 * Normalise the two input forms to groups with NaN removed, each with its label. In the x, g form a label whose
 * values are all missing has no group (as R drops an unused factor level). In the list form a group left empty is
 * dropped, or rejected with R's message when `emptyGroups` is `"error"` (kruskal.test, fligner.test).
 */
export function labelledGroups(
  x: Sample | readonly Sample[],
  g?: readonly GroupLabel[],
  emptyGroups: "drop" | "error" = "drop",
): LabelledGroups {
  if (g === undefined) {
    const list = x as readonly Sample[];
    if (list.length > 0 && typeof list[0] === "number") throw new TypeError("'g' is required when 'x' is a single sample");
    const all = list.map((s) => Array.from(s).filter((v) => !Number.isNaN(v)));
    if (emptyGroups === "error" && all.some((s) => s.length === 0)) throw new RangeError("all groups must contain data");
    const labels: string[] = [];
    const groups: number[][] = [];
    all.forEach((s, i) => {
      if (s.length === 0) return;
      labels.push(String(i + 1));
      groups.push(s);
    });
    return { labels, groups };
  }
  const xs = Array.from(x as Sample);
  if (xs.length !== g.length) throw new RangeError("'x' and 'g' must have the same length");
  const gs = factorLabels(g);
  const byLabel = new Map<GroupLabel, number[]>();
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i]!;
    const l = gs[i]!;
    if (Number.isNaN(v) || (typeof l === "number" && Number.isNaN(l))) continue;
    let arr = byLabel.get(l);
    if (arr === undefined) byLabel.set(l, (arr = []));
    arr.push(v);
  }
  const labels = Array.from(byLabel.keys()).sort(compareLabels);
  return { labels: labels.map(levelText), groups: labels.map((l) => byLabel.get(l)!) };
}

/** Normalise the two input forms to an array of non-empty groups with NaN removed (see {@link labelledGroups}) */
export function toGroups(
  x: Sample | readonly Sample[],
  g?: readonly GroupLabel[],
  emptyGroups: "drop" | "error" = "drop",
): number[][] {
  return labelledGroups(x, g, emptyGroups).groups;
}

/** Median (the mean of the two middle values for an even count) */
export function median(x: readonly number[]): number {
  const s = [...x].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2]! : midpoint(s[n / 2 - 1]!, s[n / 2]!);
}

/** Rows of a blocks x treatments table with any NaN dropped (R's complete.cases) */
export function completeRows(y: readonly (readonly number[])[]): number[][] {
  if (y.length === 0) throw new RangeError("'y' must have at least one row");
  const k = y[0]!.length;
  if (y.some((r) => r.length !== k)) throw new RangeError("all rows of 'y' must have the same length");
  return y.filter((r) => r.every((v) => !Number.isNaN(v))).map((r) => Array.from(r));
}
