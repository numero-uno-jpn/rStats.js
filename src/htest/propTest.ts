// Test of proportions (R's prop.test): one proportion against a hypothesized value, equality of k proportions, or k
// proportions against given values.
//
// Written for rStats.js from the textbook construction (no ported code). The statistic is Pearson's chi-squared on the
// k x 2 table of successes and failures, with Yates' continuity correction (|O - E| - c) for k <= 2, where c = 1/2 is
// reduced so as not to overshoot (to |x - n p| for one sample, and |p1 - p2| / (1/n1 + 1/n2) for two). One-sided
// alternatives use the signed square root of the statistic as a normal deviate. Intervals: the Wilson score interval
// with continuity correction for one proportion (Newcombe, Statistics in Medicine 17, 1998, method 4), and the Wald
// interval with continuity correction for the difference of two.

import { pgamma1 } from "../distributions/gamma.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { checkConfLevel, matchAlternative, type Alternative, type HTest } from "./types.js";

/** Options for {@link propTest}. */
export interface PropTestOptions {
  /** Hypothesized proportion(s), one per group, each strictly between 0 and 1. Default: `0.5` for one group, and
   *  equality of the proportions for several. */
  p?: number | readonly number[];
  /** Alternative hypothesis (one or two groups without `p`; otherwise only `"two.sided"`). Default `"two.sided"`. */
  alternative?: Alternative | "two" | "l" | "g";
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
  /** Apply the continuity correction (one or two groups). Default `true`. */
  correct?: boolean;
}

/** Result of {@link propTest}. */
export interface PropTestResult extends Omit<HTest, "nullValue" | "nullValueName"> {
  /** Degrees of freedom (`parameterName` is `"df"`). */
  parameter: number;
  /** The observed proportion(s). */
  estimate: number | number[];
  /** Hypothesized proportion(s), when given or for one group. */
  nullValue?: number | number[];
  nullValueName?: string | string[];
}

/**
 * Test of equal or given proportions. Equivalent to R's `prop.test()`.
 *
 * @param x Numbers of successes, or a table of rows `[successes, failures]`.
 * @param n Numbers of trials (omitted, and the options passed in its place, when `x` is a table).
 * @param options See {@link PropTestOptions}.
 *
 * @example
 * ```ts
 * propTest([83, 90, 129, 70], [86, 93, 136, 82]).pValue; // equality of four proportions
 * propTest(15, 20, { p: 0.5 }).confInt;
 * ```
 */
export function propTest(
  x: number | readonly number[] | readonly (readonly number[])[],
  n?: number | readonly number[] | PropTestOptions,
  options: PropTestOptions = {},
): PropTestResult {
  let xs: number[];
  let ns: number[];
  if (typeof x !== "number" && x.length > 0 && Array.isArray(x[0])) {
    if (n !== undefined && (typeof n !== "object" || Array.isArray(n))) throw new TypeError("'n' must be omitted when 'x' is a table");
    if (n !== undefined) options = n as PropTestOptions;
    const t = x as readonly (readonly number[])[];
    if (t.some((r) => r.length !== 2)) throw new RangeError("'x' must have 2 columns");
    xs = t.map((r) => r[0]!);
    ns = t.map((r) => r[0]! + r[1]!);
  } else {
    xs = typeof x === "number" ? [x] : Array.from(x as readonly number[]);
    if (n === undefined || (typeof n === "object" && !Array.isArray(n))) throw new TypeError("'n' is required");
    ns = typeof n === "number" ? [n] : Array.from(n as readonly number[]);
  }
  // pairs with a missing value are dropped
  const keep = xs.map((v, i) => !Number.isNaN(v) && !Number.isNaN(ns[i]!));
  if (xs.length !== ns.length) throw new RangeError("'x' and 'n' must have the same length");
  xs = xs.filter((_, i) => keep[i]);
  ns = ns.filter((_, i) => keep[i]);
  const k = xs.length;
  if (k < 1) throw new RangeError("not enough data");
  if (ns.some((v) => !(v > 0))) throw new RangeError("elements of 'n' must be positive");
  if (xs.some((v) => v < 0)) throw new RangeError("elements of 'x' must be nonnegative");
  if (xs.some((v, i) => v > ns[i]!)) throw new RangeError("elements of 'x' must not be greater than those of 'n'");

  let pNull: number[] | undefined;
  if (options.p !== undefined) {
    pNull = typeof options.p === "number" ? [options.p] : Array.from(options.p);
    if (pNull.length !== k) throw new RangeError("'p' must have the same length as 'x' and 'n'");
    if (pNull.some((v) => !(v > 0 && v < 1))) throw new RangeError("elements of 'p' must be in (0,1)");
  } else if (k === 1) pNull = [0.5];
  let alternative = matchAlternative(options.alternative);
  if (k > 2 || (k === 2 && pNull !== undefined)) alternative = "two.sided";
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevel(confLevel);
  const correct = options.correct ?? true;

  const est = xs.map((v, i) => v / ns[i]!);
  let yates = correct && k <= 2 ? 0.5 : 0;
  // the correction reduced to |O - E| itself makes every term exactly 0 (computed, they leave rounding residue)
  let clamped = false;
  let confInt: [number, number] | undefined;
  let delta = 0;
  if (k === 1) {
    const z = qnorm(alternative === "two.sided" ? (1 + confLevel) / 2 : confLevel);
    const nn = ns[0]!;
    const p = pNull![0]!;
    if (Math.abs(xs[0]! - nn * p) <= yates) {
      yates = Math.abs(xs[0]! - nn * p);
      clamped = true;
    }
    const z22n = (z * z) / (2 * nn);
    const wilson = (pc: number, sign: number): number =>
      (pc + z22n + sign * z * Math.sqrt((pc * (1 - pc)) / nn + z22n / (2 * nn))) / (1 + 2 * z22n);
    let pc = est[0]! + yates / nn;
    const pu = pc >= 1 ? 1 : wilson(pc, 1);
    pc = est[0]! - yates / nn;
    const pl = pc <= 0 ? 0 : wilson(pc, -1);
    confInt =
      alternative === "two.sided"
        ? [Math.max(pl, 0), Math.min(pu, 1)]
        : alternative === "less"
          ? [0, Math.min(pu, 1)]
          : [Math.max(pl, 0), 1];
  } else if (k === 2 && pNull === undefined) {
    delta = est[0]! - est[1]!;
    const sumInv = 1 / ns[0]! + 1 / ns[1]!;
    if (Math.abs(delta) / sumInv <= yates) {
      yates = Math.abs(delta) / sumInv;
      clamped = true;
    }
    const z = qnorm(alternative === "two.sided" ? (1 + confLevel) / 2 : confLevel);
    const width = z * Math.sqrt((est[0]! * (1 - est[0]!)) / ns[0]! + (est[1]! * (1 - est[1]!)) / ns[1]!) + yates * sumInv;
    confInt =
      alternative === "two.sided"
        ? [Math.max(delta - width, -1), Math.min(delta + width, 1)]
        : alternative === "less"
          ? [-1, Math.min(delta + width, 1)]
          : [Math.max(delta - width, -1), 1];
  }

  let df: number;
  let p: number[];
  if (pNull === undefined) {
    const pooled = xs.reduce((a, b) => a + b, 0) / ns.reduce((a, b) => a + b, 0);
    p = new Array<number>(k).fill(pooled);
    df = k - 1;
  } else {
    p = pNull;
    df = k;
  }
  let statistic = 0;
  for (let i = 0; i < k && !clamped; i++) {
    const e1 = ns[i]! * p[i]!;
    const e2 = ns[i]! * (1 - p[i]!);
    statistic += (Math.abs(xs[i]! - e1) - yates) ** 2 / e1 + (Math.abs(ns[i]! - xs[i]! - e2) - yates) ** 2 / e2;
  }

  let pValue: number;
  if (alternative === "two.sided") pValue = pgamma1(statistic, df / 2, 2, false, false);
  else {
    const sign = k === 1 ? Math.sign(est[0]! - pNull![0]!) : Math.sign(delta);
    const z = sign * Math.sqrt(statistic);
    pValue = pnorm(z, { lowerTail: alternative === "less" });
  }

  const method =
    (k === 1 ? "1-sample proportions test" : `${k}-sample test for ${pNull === undefined ? "equality of" : "given"} proportions`) +
    (yates !== 0 ? " with" : " without") +
    " continuity correction";
  const names = k === 1 ? "p" : xs.map((_, i) => `prop ${i + 1}`);
  const result: PropTestResult = {
    method,
    alternative,
    statistic,
    statisticName: "X-squared",
    parameter: df,
    parameterName: "df",
    pValue,
    estimate: k === 1 ? est[0]! : est,
    estimateNames: names,
  };
  if (confInt !== undefined) {
    result.confInt = confInt;
    result.confLevel = confLevel;
  }
  if (pNull !== undefined) {
    result.nullValue = k === 1 ? pNull[0]! : pNull;
    result.nullValueName = names;
  }
  return result;
}
