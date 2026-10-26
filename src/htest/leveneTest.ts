// Levene's test of equal variances as car's leveneTest computes it: the one-way analysis of variance of the absolute
// deviations of the values from the centre (median or mean) of their group (Brown and Forsythe's form with the
// median).
//
// Written for rStats.js from oracle/rm-tests-behaviour.md (no ported code; car's source was not read).

import { mean } from "../internal/summary.js";
import { aov } from "./aov.js";
import { labelledGroups, median, type GroupLabel } from "./groups.js";
import { matchChoice } from "./power.js";
import type { Sample } from "./types.js";

/**
 * Options for {@link leveneTest}.
 *
 * @category Hypothesis tests
 */
export interface LeveneTestOptions {
  /** The centre of each group: `"median"` (default) or `"mean"`. */
  center?: "median" | "mean" | (string & {});
}

/**
 * Result of {@link leveneTest}: car's table.
 *
 * @category Hypothesis tests
 */
export interface LeveneTestResult {
  /** `["Df", "F value", "Pr(>F)"]`. */
  colNames: string[];
  /** `["group", ""]` (the second row is the residuals). */
  rowNames: string[];
  /** One array per row; NaN where car prints nothing. */
  table: number[][];
}

/**
 * Levene's test for homogeneity of variance across groups. Equivalent to `car::leveneTest()` in R. Computes
 * `leveneTest(y ~ g, center = median)` (or `mean`). Pairs with a missing value are dropped; groups are ordered by
 * their sorted labels.
 *
 * @param y The values.
 * @param g Group labels, parallel to `y`.
 *
 * @example
 * ```ts
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * leveneTest([4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.6, 7.0, 5.5], g).table[0]; // [2, 0.15936952714535912, 0.8561748951935417]
 * ```
 *
 * @category Hypothesis tests
 */
export function leveneTest(y: Sample, g: readonly GroupLabel[], options: LeveneTestOptions = {}): LeveneTestResult {
  const center = matchChoice(options.center ?? "median", ["median", "mean"] as const);
  const { groups } = labelledGroups(y, g);
  if (groups.length < 2) throw new RangeError("contrasts can be applied only to factors with 2 or more levels");
  const deviations = groups.map((s) => {
    const c = center === "median" ? median(s) : mean(s);
    return s.map((v) => Math.abs(v - c));
  });
  const r = aov(deviations);
  return {
    colNames: ["Df", "F value", "Pr(>F)"],
    rowNames: ["group", ""],
    table: [
      [r.df[0], r.fValue, r.pValue],
      [r.df[1], NaN, NaN],
    ],
  };
}
