// Power calculations of R's stats package: power.t.test, power.prop.test and power.anova.test.
//
// Written for rStats.js from oracle/effectsize-behaviour.md (no ported code; R's source was not read). Each function
// computes the power of a test from the other quantities, or solves for the one quantity given as null with uniroot
// (src/numerics/integrate.ts), called with R's interval, tolerance and extendInt so that the iterations, and so the
// tolerance-limited root, are R's.

import { pf, qf } from "../distributions/f.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { pt, qt } from "../distributions/t.js";
import { uniroot, type UnirootOptions } from "../numerics/integrate.js";

const TOL = Number.EPSILON ** 0.25;

/** R's match.arg: the value in full, also from an unambiguous abbreviation */
export function matchChoice<T extends string>(value: string | undefined, choices: readonly T[]): T {
  if (value === undefined) return choices[0]!;
  const exact = choices.find((c) => c === value);
  if (exact !== undefined) return exact;
  const hit = choices.filter((c) => c.startsWith(value));
  if (value.length === 0 || hit.length !== 1) {
    throw new RangeError(`'arg' should be one of ${choices.map((c) => `“${c}”`).join(", ")}`);
  }
  return hit[0]!;
}

/** Whether a quantity is to be solved for: null, or omitted when R gives it no default */
export const isUnknown = (v: unknown): v is null | undefined => v === null || v === undefined;

/** The error when not exactly one of the quantities is unknown */
export function checkExactlyOne(values: readonly unknown[], message: string): void {
  if (values.filter(isUnknown).length !== 1) throw new RangeError(message);
}

/** The root of f(x) = 0 by uniroot, as the power functions call it */
export function solveFor(f: (x: number) => number, lower: number, upper: number, options: UnirootOptions = {}): number {
  return uniroot(f, lower, upper, options).root;
}

/** pt(q, df, ncp) in one tail */
export const ptNcp = (q: number, df: number, ncp: number, lowerTail: boolean): number => pt(q, df, { ncp, lowerTail });

/** Options for {@link powerTTest}. The quantity given as `null` (or omitted, for those without a default) is solved for. */
export interface PowerTTestOptions {
  /** Number of observations (per group). */
  n?: number | null;
  /** True difference in means. */
  delta?: number | null;
  /** Standard deviation. Default `1`. */
  sd?: number | null;
  /** Significance level. Default `0.05`. */
  sigLevel?: number | null;
  /** Power of the test. */
  power?: number | null;
  /** `"two.sample"` (default), `"one.sample"` or `"paired"`. */
  type?: "two.sample" | "one.sample" | "paired" | (string & {});
  /** `"two.sided"` (default) or `"one.sided"`. */
  alternative?: "two.sided" | "one.sided" | (string & {});
  /** Two-sided: count the probability of rejecting in the wrong direction too. Default `false`. */
  strict?: boolean;
  /** Tolerance of the root finding. Default `eps^0.25`. */
  tol?: number;
}

/** Result of {@link powerTTest}: R's power.htest with the solved quantity filled in. */
export interface PowerTTestResult {
  n: number;
  delta: number;
  sd: number;
  sigLevel: number;
  power: number;
  alternative: "two.sided" | "one.sided";
  note?: string;
  method: string;
}

function checkSigLevel(sigLevel: number | null | undefined, message: string): void {
  if (sigLevel !== null && sigLevel !== undefined && !(typeof sigLevel === "number" && sigLevel >= 0 && sigLevel <= 1)) {
    throw new RangeError(message);
  }
}
const SIG_MESSAGE = "'sig.level' must be numeric in [0, 1]";

/**
 * Power of a one- or two-sample t test, or the sample size, difference, standard deviation or significance level
 * for a given power. Equivalent to R's `power.t.test()`.
 *
 * @example
 * ```ts
 * powerTTest({ n: 20, delta: 1 }).power;           // 0.8689528016921269
 * powerTTest({ delta: 0.5, power: 0.8 }).n;        // 63.765763714280546
 * ```
 */
export function powerTTest(options: PowerTTestOptions = {}): PowerTTestResult {
  let { n, delta, power } = options;
  let sd = options.sd === undefined ? 1 : options.sd;
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([n, delta, sd, power, sigLevel], "exactly one of 'n', 'delta', 'sd', 'power', and 'sig.level' must be NULL");
  checkSigLevel(sigLevel, SIG_MESSAGE);
  const type = matchChoice(options.type, ["two.sample", "one.sample", "paired"] as const);
  const alternative = matchChoice(options.alternative, ["two.sided", "one.sided"] as const);
  const strict = options.strict ?? false;
  const tol = options.tol ?? TOL;
  const ts = type === "two.sample" ? 2 : 1;
  const sides = alternative === "two.sided" ? 2 : 1;
  if (sides === 2 && !isUnknown(delta)) delta = Math.abs(delta);
  const powerOf = (n: number, delta: number, sd: number, sig: number): number => {
    const nu = Math.max(1e-7, n - 1) * ts;
    const q = qt(sig / sides, nu, { lowerTail: false });
    const ncp = (Math.sqrt(n / ts) * delta) / sd;
    const p = ptNcp(q, nu, ncp, false);
    return strict && sides === 2 ? p + ptNcp(-q, nu, ncp, true) : p;
  };
  if (isUnknown(power)) power = powerOf(n!, delta!, sd!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(n)) n = solveFor((x) => powerOf(x, delta!, sd!, sigLevel!) - target, 2, 1e7, { tol, extendInt: "upX" });
    else if (isUnknown(sd)) {
      sd = solveFor((x) => powerOf(n!, delta!, x, sigLevel!) - target, delta! * 1e-7, delta! * 1e7, { tol, extendInt: "downX" });
    } else if (isUnknown(delta)) {
      delta = solveFor((x) => powerOf(n!, x, sd!, sigLevel!) - target, sd * 1e-7, sd * 1e7, { tol, extendInt: "upX" });
    } else {
      sigLevel = solveFor((x) => powerOf(n!, delta!, sd!, x) - target, 1e-10, 1 - 1e-10, { tol, extendInt: "yes" });
    }
  }
  const note =
    type === "paired"
      ? "n is number of *pairs*, sd is std.dev. of *differences* within pairs"
      : type === "two.sample"
        ? "n is number in *each* group"
        : undefined;
  const method = { "two.sample": "Two-sample", "one.sample": "One-sample", paired: "Paired" }[type] + " t test power calculation";
  return {
    n: n!,
    delta: delta!,
    sd: sd!,
    sigLevel: sigLevel!,
    power,
    alternative,
    ...(note === undefined ? {} : { note }),
    method,
  };
}

/** Options for {@link powerPropTest}. The quantity given as `null` (or omitted, for those without a default) is solved for. */
export interface PowerPropTestOptions {
  /** Number of observations per group. */
  n?: number | null;
  /** Probability in one group. */
  p1?: number | null;
  /** Probability in the other group. */
  p2?: number | null;
  /** Significance level. Default `0.05`. */
  sigLevel?: number | null;
  /** Power of the test. */
  power?: number | null;
  /** `"two.sided"` (default) or `"one.sided"`. */
  alternative?: "two.sided" | "one.sided" | (string & {});
  /** Two-sided: count the probability of rejecting in the wrong direction too. Default `false`. */
  strict?: boolean;
  /** Tolerance of the root finding. Default `eps^0.25`. */
  tol?: number;
}

/** Result of {@link powerPropTest}. */
export interface PowerPropTestResult {
  n: number;
  p1: number;
  p2: number;
  sigLevel: number;
  power: number;
  alternative: "two.sided" | "one.sided";
  note: string;
  method: string;
  /** R's warnings. */
  warnings: string[];
}

/**
 * Power of the test of two proportions, or the sample size, a probability or the significance level for a given
 * power. Equivalent to R's `power.prop.test()`.
 *
 * @example
 * ```ts
 * powerPropTest({ n: 50, p1: 0.5, p2: 0.75 }).power;   // 0.7401659013313878
 * ```
 */
export function powerPropTest(options: PowerPropTestOptions = {}): PowerPropTestResult {
  let { n, p1, p2, power } = options;
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([n, p1, p2, power, sigLevel], "exactly one of 'n', 'p1', 'p2', 'power', and 'sig.level' must be NULL");
  checkSigLevel(sigLevel, SIG_MESSAGE);
  const alternative = matchChoice(options.alternative, ["two.sided", "one.sided"] as const);
  const strict = options.strict ?? false;
  const tol = options.tol ?? TOL;
  const sides = alternative === "two.sided" ? 2 : 1;
  const powerOf = (n: number, p1: number, p2: number, sig: number): number => {
    const z = qnorm(sig / sides, { lowerTail: false });
    if (strict && sides === 2) {
      const pbar = (p1 + p2) / 2;
      const v1 = p1 * (1 - p1);
      const v2 = p2 * (1 - p2);
      const vbar = pbar * (1 - pbar);
      const d = Math.abs(p1 - p2);
      const s = Math.sqrt(v1 + v2);
      return (
        pnorm((Math.sqrt(n) * d - z * Math.sqrt(2 * vbar)) / s) +
        pnorm((Math.sqrt(n) * d + z * Math.sqrt(2 * vbar)) / s, { lowerTail: false })
      );
    }
    return pnorm(
      (Math.sqrt(n) * Math.abs(p1 - p2) - z * Math.sqrt((p1 + p2) * (1 - (p1 + p2) / 2))) / Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    );
  };
  const warnings: string[] = [];
  if (isUnknown(power)) power = powerOf(n!, p1!, p2!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(n)) n = solveFor((x) => powerOf(x, p1!, p2!, sigLevel!) - target, 1, 1e7, { tol, extendInt: "upX" });
    else if (isUnknown(p1)) {
      p1 = solveFor((x) => powerOf(n!, x, p2!, sigLevel!) - target, 0, p2!, { tol, extendInt: "yes" });
      if (p1 < 0) warnings.push("No p1 in [0, p2] can be found to achieve the desired power");
    } else if (isUnknown(p2)) {
      p2 = solveFor((x) => powerOf(n!, p1!, x, sigLevel!) - target, p1, 1, { tol, extendInt: "yes" });
      if (p2 > 1) warnings.push("No p2 in [p1, 1] can be found to achieve the desired power");
    } else {
      sigLevel = solveFor((x) => powerOf(n!, p1!, p2!, x) - target, 1e-10, 1 - 1e-10, { tol, extendInt: "upX" });
      if (sigLevel < 0 || sigLevel > 1) warnings.push("No significance level [0, 1] can be found to achieve the desired power");
    }
  }
  return {
    n: n!,
    p1: p1!,
    p2: p2!,
    sigLevel: sigLevel!,
    power,
    alternative,
    note: "n is number in *each* group",
    method: "Two-sample comparison of proportions power calculation",
    warnings,
  };
}

/** Options for {@link powerAnovaTest}. The quantity given as `null` (or omitted, for those without a default) is solved for. */
export interface PowerAnovaTestOptions {
  /** Number of groups. */
  groups?: number | null;
  /** Number of observations per group. */
  n?: number | null;
  /** Variance between the groups' means. */
  betweenVar?: number | null;
  /** Variance within the groups. */
  withinVar?: number | null;
  /** Significance level. Default `0.05`. */
  sigLevel?: number | null;
  /** Power of the test. */
  power?: number | null;
}

/** Result of {@link powerAnovaTest}. */
export interface PowerAnovaTestResult {
  groups: number;
  n: number;
  betweenVar: number;
  withinVar: number;
  sigLevel: number;
  power: number;
  note: string;
  method: string;
}

/**
 * Power of the F test of a balanced one-way analysis of variance, or one of the other quantities for a given power.
 * Equivalent to R's `power.anova.test()`.
 *
 * @example
 * ```ts
 * powerAnovaTest({ groups: 4, n: 5, betweenVar: 1, withinVar: 3 }).power;   // 0.3535594237229933
 * ```
 */
export function powerAnovaTest(options: PowerAnovaTestOptions = {}): PowerAnovaTestResult {
  let { groups, n, betweenVar, withinVar, power } = options;
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne(
    [groups, n, betweenVar, withinVar, power, sigLevel],
    "exactly one of 'groups', 'n', 'between.var', 'within.var', 'power', and 'sig.level' must be NULL",
  );
  if (!isUnknown(groups) && groups < 2) throw new RangeError("number of groups must be at least 2");
  if (!isUnknown(n) && n < 2) throw new RangeError("number of observations in each group must be at least 2");
  checkSigLevel(sigLevel, SIG_MESSAGE);
  const powerOf = (groups: number, n: number, between: number, within: number, sig: number): number => {
    const lambda = ((groups - 1) * n * between) / within;
    const df1 = groups - 1;
    const df2 = (n - 1) * groups;
    return pf(qf(sig, df1, df2, { lowerTail: false }), df1, df2, { ncp: lambda, lowerTail: false });
  };
  if (isUnknown(power)) power = powerOf(groups!, n!, betweenVar!, withinVar!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(groups)) groups = solveFor((x) => powerOf(x, n!, betweenVar!, withinVar!, sigLevel!) - target, 2, 100);
    else if (isUnknown(n)) n = solveFor((x) => powerOf(groups!, x, betweenVar!, withinVar!, sigLevel!) - target, 2, 1e5);
    else if (isUnknown(withinVar)) {
      withinVar = solveFor((x) => powerOf(groups!, n!, betweenVar!, x, sigLevel!) - target, betweenVar! * 1e-7, betweenVar! * 1e7);
    } else if (isUnknown(betweenVar)) {
      betweenVar = solveFor((x) => powerOf(groups!, n!, x, withinVar!, sigLevel!) - target, withinVar * 1e-7, withinVar * 1e7);
    } else {
      sigLevel = solveFor((x) => powerOf(groups!, n!, betweenVar!, withinVar!, x) - target, 1e-10, 1 - 1e-10);
    }
  }
  return {
    groups: groups!,
    n: n!,
    betweenVar: betweenVar!,
    withinVar: withinVar!,
    sigLevel: sigLevel!,
    power,
    note: "n is number in each group",
    method: "Balanced one-way analysis of variance power calculation",
  };
}
