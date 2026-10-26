// Power calculations of the pwr package (Cohen's effect sizes): pwr.t.test, pwr.t2n.test, pwr.2p.test,
// pwr.2p2n.test, pwr.p.test, pwr.norm.test, pwr.r.test, pwr.chisq.test, pwr.anova.test, pwr.f2.test, and the
// effect-size helpers ES.h, ES.w1, ES.w2 and cohen.ES.
//
// Written for rStats.js from oracle/effectsize-behaviour.md (no ported code; pwr's source was not read). The quantity
// given as null is solved for with uniroot (src/numerics/integrate.ts) on pwr's intervals with uniroot's default
// tolerance and no extension of the interval, so that the tolerance-limited root is pwr's.

import { pchisq, qchisq } from "../distributions/chisq.js";
import { pf, qf } from "../distributions/f.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { qt } from "../distributions/t.js";
import { checkExactlyOne, isUnknown, matchChoice, ptNcp, solveFor } from "./power.js";
import type { Alternative } from "./types.js";

/**
 * An effect size: a number, or Cohen's conventional `"small"`, `"medium"` or `"large"`
 *
 * @category Effect sizes and power
 */
export type EffectSize = number | "small" | "medium" | "large";

/**
 * The tests of {@link cohenES}
 *
 * @category Effect sizes and power
 */
export type CohenTest = "p" | "t" | "r" | "anov" | "chisq" | "f2";

/**
 * Result of {@link cohenES}.
 *
 * @category Effect sizes and power
 */
export interface CohenESResult {
  /** The test. */
  test: CohenTest;
  /** The conventional size. */
  size: "small" | "medium" | "large";
  /** Cohen's effect size (R's `effect.size`). */
  effectSize: number;
  /** Description of the calculation. */
  method: string;
}

const COHEN: Record<CohenTest, [number, number, number]> = {
  p: [0.2, 0.5, 0.8],
  t: [0.2, 0.5, 0.8],
  r: [0.1, 0.3, 0.5],
  anov: [0.1, 0.25, 0.4],
  chisq: [0.1, 0.3, 0.5],
  f2: [0.02, 0.15, 0.35],
};

/**
 * Cohen's conventional effect sizes. Equivalent to `pwr::cohen.ES(test, size)` in R.
 *
 * @example
 * ```ts
 * cohenES("anov", "medium").effectSize; // 0.25
 * ```
 *
 * @category Effect sizes and power
 */
export function cohenES(test: CohenTest | (string & {}) = "p", size: "small" | "medium" | "large" | (string & {}) = "small"): CohenESResult {
  const t = matchChoice(test, ["p", "t", "r", "anov", "chisq", "f2"] as const);
  const s = matchChoice(size, ["small", "medium", "large"] as const);
  return { test: t, size: s, effectSize: COHEN[t][["small", "medium", "large"].indexOf(s)]!, method: "Conventional effect size from Cohen (1982)" };
}

/**
 * Effect size h of two proportions: `2 asin(sqrt(p1)) - 2 asin(sqrt(p2))`. Equivalent to `pwr::ES.h()` in R.
 *
 * @example
 * ```ts
 * esH(0.65, 0.45); // 0.40486007517695755
 * ```
 *
 * @category Effect sizes and power
 */
export function esH(p1: number, p2: number): number {
  return 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2));
}

/**
 * Effect size w of a goodness-of-fit test, `sqrt(sum((p1 - p0)^2 / p0))`. Equivalent to `pwr::ES.w1()` in R.
 *
 * @example
 * ```ts
 * esW1([0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2]); // 0.34641016151377546
 * ```
 *
 * @category Effect sizes and power
 */
export function esW1(p0: readonly number[], p1: readonly number[]): number {
  if (p0.length !== p1.length) throw new RangeError("'P0' and 'P1' must have the same length");
  let s = 0;
  for (let i = 0; i < p0.length; i++) s += (p1[i]! - p0[i]!) ** 2 / p0[i]!;
  return Math.sqrt(s);
}

/**
 * Effect size w of a test of association, for a matrix of cell probabilities (an array of rows): with the row sums
 * r and column sums c, `p0 = r c'` and `sqrt(sum((p - p0)^2 / p0))`. Equivalent to `pwr::ES.w2()` in R.
 *
 * @example
 * ```ts
 * esW2([[0.3, 0.2], [0.1, 0.4]]); // 0.40824829046386296
 * ```
 *
 * @category Effect sizes and power
 */
export function esW2(p: readonly (readonly number[])[]): number {
  const rows = p.map((r) => r.reduce((a, b) => a + b, 0));
  const nc = p[0]?.length ?? 0;
  const cols = Array.from({ length: nc }, (_, j) => p.reduce((a, r) => a + r[j]!, 0));
  let s = 0;
  // column-major order, as R sums a matrix
  for (let j = 0; j < nc; j++) {
    for (let i = 0; i < p.length; i++) {
      const p0 = rows[i]! * cols[j]!;
      s += (p[i]![j]! - p0) ** 2 / p0;
    }
  }
  return Math.sqrt(s);
}

type Unknown = number | null | undefined;
const SIG_MESSAGE = "‘sig.level’ must be numeric in [0, 1]";
const POWER_MESSAGE = "‘power’ must be numeric in [0, 1]";

function checkProbabilities(sigLevel: Unknown, power: Unknown): void {
  const bad = (v: Unknown): boolean => !isUnknown(v) && !(typeof v === "number" && v >= 0 && v <= 1);
  if (bad(sigLevel)) throw new RangeError(SIG_MESSAGE);
  if (bad(power)) throw new RangeError(POWER_MESSAGE);
}

/** A string effect size replaced by Cohen's value for the test */
function effect(es: EffectSize | null | undefined, test: CohenTest): Unknown {
  return typeof es === "string" ? cohenES(test, es).effectSize : es;
}

const ALTERNATIVES = ["two.sided", "less", "greater"] as const;

/** The interval of an effect size: two-sided, less, greater */
function esInterval(alt: Alternative, two: [number, number]): [number, number] {
  return alt === "two.sided" ? two : alt === "less" ? [-10, 5] : [-5, 10];
}

/** The power of a t test with nu degrees of freedom and noncentrality ncp, by pwr's rejection regions */
function tPower(nu: number, ncp: number, sig: number, alt: Alternative): number {
  if (alt === "less") return ptNcp(qt(sig, nu) as number, nu, ncp, true);
  if (alt === "greater") return ptNcp(qt(sig, nu, { lowerTail: false }) as number, nu, ncp, false);
  const q = qt(sig / 2, nu, { lowerTail: false }) as number;
  return ptNcp(q, nu, ncp, false) + ptNcp(-q, nu, ncp, true);
}

/** The power of a normal test with shift `es * scale`, by pwr's rejection regions */
function normalPower(shift: number, sig: number, alt: Alternative): number {
  if (alt === "greater") return pnorm((qnorm(1 - sig) as number) - shift, { lowerTail: false }) as number;
  if (alt === "less") return pnorm((qnorm(sig) as number) - shift) as number;
  return (
    (pnorm((qnorm(1 - sig / 2) as number) - shift, { lowerTail: false }) as number) + (pnorm((qnorm(sig / 2) as number) - shift) as number)
  );
}

/** Common options of the pwr functions */
interface PwrCommon {
  /** Significance level. Default `0.05`. */
  sigLevel?: number | null;
  /** Power of the test. */
  power?: number | null;
}

/** Common options of the pwr functions with an alternative */
interface PwrAlternative extends PwrCommon {
  /** `"two.sided"` (default), `"less"` or `"greater"`; unambiguous abbreviations are accepted. */
  alternative?: Alternative | (string & {});
}

/**
 * Options for {@link pwrTTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrTTestOptions extends PwrAlternative {
  /** Number of observations (per group, or of pairs). */
  n?: number | null;
  /** Effect size d (Cohen's d), or `"small"`, `"medium"`, `"large"`. */
  d?: EffectSize | null;
  /** `"two.sample"` (default), `"one.sample"` or `"paired"`. */
  type?: "two.sample" | "one.sample" | "paired" | (string & {});
}

/**
 * Result of {@link pwrTTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrTTestResult {
  /** Number of observations (per group, or of pairs). */
  n: number;
  /** Effect size d. */
  d: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** The alternative hypothesis. */
  alternative: Alternative;
  /** A note on the sample size. */
  note?: string;
  /** Description of the calculation. */
  method: string;
}

/**
 * Power of a t test of means, or the sample size, effect size or significance level for a given power.
 * Equivalent to `pwr::pwr.t.test()` in R.
 *
 * @example
 * ```ts
 * pwrTTest({ n: 20, d: 0.5 }).power;          // 0.3379390289250411
 * pwrTTest({ d: 0.5, power: 0.8 }).n;         // 63.76561044415068
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrTTest(options: PwrTTestOptions = {}): PwrTTestResult {
  let { n, power } = options;
  let d = effect(options.d, "t");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([n, d, power, sigLevel], "exactly one of n, d, power, and sig.level must be NULL");
  checkProbabilities(sigLevel, power);
  const type = matchChoice(options.type, ["two.sample", "one.sample", "paired"] as const);
  const alt = matchChoice(options.alternative, ALTERNATIVES);
  const ts = type === "two.sample" ? 2 : 1;
  if (alt === "two.sided" && !isUnknown(d)) d = Math.abs(d);
  const powerOf = (n: number, d: number, sig: number): number => tPower((n - 1) * ts, Math.sqrt(n / ts) * d, sig, alt);
  if (isUnknown(power)) power = powerOf(n!, d!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(n)) n = solveFor((x) => powerOf(x, d!, sigLevel!) - target, 2 + 1e-10, 1e9);
    else if (isUnknown(d)) d = solveFor((x) => powerOf(n!, x, sigLevel!) - target, ...esInterval(alt, [1e-7, 10]));
    else sigLevel = solveFor((x) => powerOf(n!, d!, x) - target, 1e-10, 1 - 1e-10);
  }
  const note = type === "paired" ? "n is number of *pairs*" : type === "two.sample" ? "n is number in *each* group" : undefined;
  const method = { "two.sample": "Two-sample", "one.sample": "One-sample", paired: "Paired" }[type] + " t test power calculation";
  return { n: n!, d: d!, sigLevel: sigLevel!, power, alternative: alt, ...(note === undefined ? {} : { note }), method };
}

/**
 * Options for {@link pwrT2nTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrT2nTestOptions extends PwrAlternative {
  /** Number of observations in the first group. */
  n1?: number | null;
  /** Number of observations in the second group. */
  n2?: number | null;
  /** Effect size d, or `"small"`, `"medium"`, `"large"`. */
  d?: EffectSize | null;
}

/**
 * Result of {@link pwrT2nTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrT2nTestResult {
  /** Number of observations in the first group. */
  n1: number;
  /** Number of observations in the second group. */
  n2: number;
  /** Effect size d. */
  d: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** The alternative hypothesis. */
  alternative: Alternative;
  /** Description of the calculation. */
  method: string;
}

/**
 * Power of a two-sample t test with unequal sample sizes, or a sample size, the effect size or the significance
 * level for a given power. Equivalent to `pwr::pwr.t2n.test()` in R.
 *
 * @example
 * ```ts
 * pwrT2nTest({ n1: 20, n2: 30, d: 0.5 }).power; // 0.39656999440895696
 * pwrT2nTest({ n1: 50, d: 0.5, power: 0.8 }).n2; // 87.70891347276086
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrT2nTest(options: PwrT2nTestOptions = {}): PwrT2nTestResult {
  let { n1, n2, power } = options;
  let d = effect(options.d, "t");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([n1, n2, d, power, sigLevel], "exactly one of n1, n2, d, power, and sig.level must be NULL");
  checkProbabilities(sigLevel, power);
  if (!isUnknown(n1) && n1 < 2) throw new RangeError("number of observations in the first group must be at least 2");
  if (!isUnknown(n2) && n2 < 2) throw new RangeError("number of observations in the second group must be at least 2");
  const alt = matchChoice(options.alternative, ALTERNATIVES);
  if (alt === "two.sided" && !isUnknown(d)) d = Math.abs(d);
  const powerOf = (n1: number, n2: number, d: number, sig: number): number =>
    tPower(n1 + n2 - 2, d / Math.sqrt(1 / n1 + 1 / n2), sig, alt);
  if (isUnknown(power)) power = powerOf(n1!, n2!, d!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(n1)) n1 = solveFor((x) => powerOf(x, n2!, d!, sigLevel!) - target, 2 + 1e-10, 1e9);
    else if (isUnknown(n2)) n2 = solveFor((x) => powerOf(n1!, x, d!, sigLevel!) - target, 2 + 1e-10, 1e9);
    else if (isUnknown(d)) d = solveFor((x) => powerOf(n1!, n2!, x, sigLevel!) - target, ...esInterval(alt, [1e-7, 10]));
    else sigLevel = solveFor((x) => powerOf(n1!, n2!, d!, x) - target, 1e-10, 1 - 1e-10);
  }
  return { n1: n1!, n2: n2!, d: d!, sigLevel: sigLevel!, power, alternative: alt, method: "t test power calculation" };
}

/**
 * Options for {@link pwr2pTest} and {@link pwrPTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface Pwr2pTestOptions extends PwrAlternative {
  /** Effect size h ({@link esH}), or `"small"`, `"medium"`, `"large"`. */
  h?: EffectSize | null;
  /** Number of observations (per group for {@link pwr2pTest}). */
  n?: number | null;
}

/**
 * Result of {@link pwr2pTest} and {@link pwrPTest}.
 *
 * @category Effect sizes and power
 */
export interface Pwr2pTestResult {
  /** Effect size h. */
  h: number;
  /** Number of observations (per group for {@link pwr2pTest}). */
  n: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** The alternative hypothesis. */
  alternative: Alternative;
  /** Description of the calculation. */
  method: string;
  /** A note on the sample sizes (absent for {@link pwrPTest}). */
  note?: string;
}

/** The normal-approximation tests: pwr.2p.test (scale sqrt(n/2)), pwr.p.test and pwr.norm.test (sqrt(n)) */
function normalTest(
  es0: EffectSize | null | undefined,
  options: PwrAlternative & { n?: number | null },
  name: "h" | "d",
  scale: (n: number) => number,
  nLower: number,
  esLower: number,
): { es: number; n: number; sigLevel: number; power: number; alternative: Alternative } {
  let { n, power } = options;
  let es = effect(es0, name === "h" ? "p" : "t");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([es, n, power, sigLevel], `exactly one of ${name}, n, power, and sig.level must be NULL`);
  checkProbabilities(sigLevel, power);
  if (!isUnknown(n) && n < 1) throw new RangeError("number of observations in each group must be at least 1");
  const alt = matchChoice(options.alternative, ALTERNATIVES);
  if (alt === "two.sided" && !isUnknown(es)) es = Math.abs(es);
  const powerOf = (es: number, n: number, sig: number): number => normalPower(es * scale(n), sig, alt);
  if (isUnknown(power)) power = powerOf(es!, n!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(es)) es = solveFor((x) => powerOf(x, n!, sigLevel!) - target, ...esInterval(alt, [esLower, 10]));
    else if (isUnknown(n)) n = solveFor((x) => powerOf(es!, x, sigLevel!) - target, nLower, 1e9);
    else sigLevel = solveFor((x) => powerOf(es!, n!, x) - target, 1e-10, 1 - 1e-10);
  }
  return { es: es!, n: n!, sigLevel: sigLevel!, power, alternative: alt };
}

/**
 * Power of the test of two proportions with equal sample sizes (arcsine transformation), or the effect size, sample
 * size or significance level for a given power. Equivalent to `pwr::pwr.2p.test()` in R.
 *
 * @example
 * ```ts
 * pwr2pTest({ h: 0.3, n: 80 }).power; // 0.47510087057263806
 * pwr2pTest({ h: esH(0.65, 0.45), power: 0.8 }).n; // 95.76938656160651
 * ```
 *
 * @category Effect sizes and power
 */
export function pwr2pTest(options: Pwr2pTestOptions = {}): Pwr2pTestResult {
  const r = normalTest(options.h, options, "h", (n) => Math.sqrt(n / 2), 2 + 1e-10, 1e-10);
  return {
    h: r.es,
    n: r.n,
    sigLevel: r.sigLevel,
    power: r.power,
    alternative: r.alternative,
    method: "Difference of proportion power calculation for binomial distribution (arcsine transformation)",
    note: "same sample sizes",
  };
}

/**
 * Power of the test of one proportion (arcsine transformation), or the effect size, sample size or significance
 * level for a given power. Equivalent to `pwr::pwr.p.test()` in R.
 *
 * @example
 * ```ts
 * pwrPTest({ h: 0.2, n: 60 }).power; // 0.34084512406749834
 * pwrPTest({ h: 0.2, power: 0.8 }).n; // 196.221512550509
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrPTest(options: Pwr2pTestOptions = {}): Pwr2pTestResult {
  const r = normalTest(options.h, options, "h", (n) => Math.sqrt(n), 2 + 1e-10, 1e-10);
  return {
    h: r.es,
    n: r.n,
    sigLevel: r.sigLevel,
    power: r.power,
    alternative: r.alternative,
    method: "proportion power calculation for binomial distribution (arcsine transformation)",
  };
}

/**
 * Options for {@link pwrNormTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrNormTestOptions extends PwrAlternative {
  /** Effect size d (difference of means over the known standard deviation), or `"small"`, `"medium"`, `"large"`. */
  d?: EffectSize | null;
  /** Number of observations. */
  n?: number | null;
}

/**
 * Result of {@link pwrNormTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrNormTestResult {
  /** Effect size d. */
  d: number;
  /** Number of observations. */
  n: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** The alternative hypothesis. */
  alternative: Alternative;
  /** Description of the calculation. */
  method: string;
}

/**
 * Power of the test of a mean of a normal distribution with known variance, or the effect size, sample size or
 * significance level for a given power. Equivalent to `pwr::pwr.norm.test()` in R.
 *
 * @example
 * ```ts
 * pwrNormTest({ d: 0.3, n: 50 }).power; // 0.5641160254310038
 * pwrNormTest({ d: 0.3, power: 0.8 }).n; // 87.20953791564195
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrNormTest(options: PwrNormTestOptions = {}): PwrNormTestResult {
  const r = normalTest(options.d, options, "d", (n) => Math.sqrt(n), 1 + 1e-10, 1e-10);
  return {
    d: r.es,
    n: r.n,
    sigLevel: r.sigLevel,
    power: r.power,
    alternative: r.alternative,
    method: "Mean power calculation for normal distribution with known variance",
  };
}

/**
 * Options for {@link pwr2p2nTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface Pwr2p2nTestOptions extends PwrAlternative {
  /** Effect size h ({@link esH}), or `"small"`, `"medium"`, `"large"`. */
  h?: EffectSize | null;
  /** Number of observations in the first group. */
  n1?: number | null;
  /** Number of observations in the second group. */
  n2?: number | null;
}

/**
 * Result of {@link pwr2p2nTest}.
 *
 * @category Effect sizes and power
 */
export interface Pwr2p2nTestResult {
  /** Effect size h. */
  h: number;
  /** Number of observations in the first group. */
  n1: number;
  /** Number of observations in the second group. */
  n2: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** The alternative hypothesis. */
  alternative: Alternative;
  /** Description of the calculation. */
  method: string;
  /** A note on the sample sizes. */
  note: string;
}

/**
 * Power of the test of two proportions with unequal sample sizes (arcsine transformation), or the effect size, a
 * sample size or the significance level for a given power. Equivalent to `pwr::pwr.2p2n.test()` in R.
 *
 * @example
 * ```ts
 * pwr2p2nTest({ h: 0.3, n1: 80, n2: 120 }).power; // 0.5471899635264242
 * pwr2p2nTest({ h: 0.3, n1: 200, power: 0.8 }).n2; // 154.6399892648981
 * ```
 *
 * @category Effect sizes and power
 */
export function pwr2p2nTest(options: Pwr2p2nTestOptions = {}): Pwr2p2nTestResult {
  let { n1, n2, power } = options;
  let h = effect(options.h, "p");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([h, n1, n2, power, sigLevel], "exactly one of h, n1, n2, power, and sig.level must be NULL");
  checkProbabilities(sigLevel, power);
  if (!isUnknown(n1) && n1 < 2) throw new RangeError("number of observations in the first group must be at least 2");
  if (!isUnknown(n2) && n2 < 2) throw new RangeError("number of observations in the second group must be at least 2");
  const alt = matchChoice(options.alternative, ALTERNATIVES);
  if (alt === "two.sided" && !isUnknown(h)) h = Math.abs(h);
  const powerOf = (h: number, n1: number, n2: number, sig: number): number => normalPower(h * Math.sqrt((n1 * n2) / (n1 + n2)), sig, alt);
  if (isUnknown(power)) power = powerOf(h!, n1!, n2!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(h)) h = solveFor((x) => powerOf(x, n1!, n2!, sigLevel!) - target, ...esInterval(alt, [1e-10, 10]));
    else if (isUnknown(n1)) n1 = solveFor((x) => powerOf(h!, x, n2!, sigLevel!) - target, 2 + 1e-10, 1e9);
    else if (isUnknown(n2)) n2 = solveFor((x) => powerOf(h!, n1!, x, sigLevel!) - target, 2 + 1e-10, 1e9);
    else sigLevel = solveFor((x) => powerOf(h!, n1!, n2!, x) - target, 1e-10, 1 - 1e-10);
  }
  return {
    h: h!,
    n1: n1!,
    n2: n2!,
    sigLevel: sigLevel!,
    power,
    alternative: alt,
    method: "difference of proportion power calculation for binomial distribution (arcsine transformation)",
    note: "different sample sizes",
  };
}

/**
 * Options for {@link pwrRTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrRTestOptions extends PwrAlternative {
  /** Number of observations. */
  n?: number | null;
  /** Correlation, or `"small"`, `"medium"`, `"large"`. */
  r?: EffectSize | null;
}

/**
 * Result of {@link pwrRTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrRTestResult {
  /** Number of observations. */
  n: number;
  /** Correlation. */
  r: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** The alternative hypothesis. */
  alternative: Alternative;
  /** Description of the calculation. */
  method: string;
}

/**
 * Power of the test of a correlation (Fisher's z transformation), or the sample size, correlation or significance
 * level for a given power. Equivalent to `pwr::pwr.r.test()` in R. As in pwr, the power computed for `"less"` reports
 * `r` negated.
 *
 * @example
 * ```ts
 * pwrRTest({ n: 50, r: 0.3 }).power; // 0.571555841860208
 * pwrRTest({ r: 0.3, power: 0.8 }).n; // 84.07363978228769
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrRTest(options: PwrRTestOptions = {}): PwrRTestResult {
  let { n, power } = options;
  let r = effect(options.r, "r");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([n, r, power, sigLevel], "exactly one of n, r, power, and sig.level must be NULL");
  checkProbabilities(sigLevel, power);
  if (!isUnknown(n) && n < 4) throw new RangeError("number of observations must be at least 4");
  const alt = matchChoice(options.alternative, ALTERNATIVES);
  if (alt === "two.sided" && !isUnknown(r)) r = Math.abs(r);
  const upper = (n: number, r: number, sig: number, twoSided: boolean): number => {
    const t = qt(twoSided ? sig / 2 : sig, n - 2, { lowerTail: false }) as number;
    const rc = Math.sqrt(t ** 2 / (t ** 2 + n - 2));
    const zr = Math.atanh(r) + r / (2 * (n - 1));
    const zrc = Math.atanh(rc);
    const p = pnorm((zr - zrc) * Math.sqrt(n - 3)) as number;
    return twoSided ? p + (pnorm((-zr - zrc) * Math.sqrt(n - 3)) as number) : p;
  };
  const powerOf = (n: number, r: number, sig: number): number =>
    alt === "two.sided" ? upper(n, r, sig, true) : upper(n, alt === "less" ? -r : r, sig, false);
  if (isUnknown(power)) {
    power = powerOf(n!, r!, sigLevel!);
    if (alt === "less") r = -r!;
  } else {
    const target = power;
    if (isUnknown(n)) n = solveFor((x) => powerOf(x, r!, sigLevel!) - target, 4 + 1e-10, 1e9);
    else if (isUnknown(r)) {
      const [lo, hi] = alt === "two.sided" ? [1e-10, 1 - 1e-10] : [-1 + 1e-10, 1 - 1e-10];
      r = solveFor((x) => powerOf(n!, x, sigLevel!) - target, lo, hi);
    } else sigLevel = solveFor((x) => powerOf(n!, r!, x) - target, 1e-10, 1 - 1e-10);
  }
  return {
    n: n!,
    r: r!,
    sigLevel: sigLevel!,
    power,
    alternative: alt,
    method: "approximate correlation power calculation (arctangh transformation)",
  };
}

/**
 * Options for {@link pwrChisqTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrChisqTestOptions extends PwrCommon {
  /** Effect size w ({@link esW1}, {@link esW2}), or `"small"`, `"medium"`, `"large"`. */
  w?: EffectSize | null;
  /** Total number of observations. */
  N?: number | null;
  /** Degrees of freedom. */
  df: number;
}

/**
 * Result of {@link pwrChisqTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrChisqTestResult {
  /** Effect size w. */
  w: number;
  /** Total number of observations. */
  N: number;
  /** Degrees of freedom. */
  df: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** Description of the calculation. */
  method: string;
  /** A note on the sample size. */
  note: string;
}

/**
 * Power of a chi-squared test, or the effect size, number of observations or significance level for a given power.
 * Equivalent to `pwr::pwr.chisq.test()` in R.
 *
 * @example
 * ```ts
 * pwrChisqTest({ w: 0.3, N: 100, df: 3 }).power; // 0.7112535997950422
 * pwrChisqTest({ w: 0.3, df: 3, power: 0.8 }).N; // 121.13959310294602
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrChisqTest(options: PwrChisqTestOptions): PwrChisqTestResult {
  let { N, power } = options;
  const { df } = options;
  let w = effect(options.w, "chisq");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([w, N, power, sigLevel], "exactly one of w, N, power, and sig.level must be NULL");
  if (typeof df !== "number") throw new TypeError('argument "df" is missing, with no default');
  checkProbabilities(sigLevel, power);
  if (!isUnknown(w) && w < 0) throw new RangeError("w must be positive");
  if (!isUnknown(N) && N < 1) throw new RangeError("number of observations must be at least 1");
  const powerOf = (w: number, N: number, sig: number): number =>
    pchisq(qchisq(sig, df, { lowerTail: false }) as number, df, { ncp: N * w ** 2, lowerTail: false }) as number;
  if (isUnknown(power)) power = powerOf(w!, N!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(w)) w = solveFor((x) => powerOf(x, N!, sigLevel!) - target, 1e-10, 1e9);
    else if (isUnknown(N)) N = solveFor((x) => powerOf(w!, x, sigLevel!) - target, 1 + 1e-10, 1e9);
    else sigLevel = solveFor((x) => powerOf(w!, N!, x) - target, 1e-10, 1 - 1e-10);
  }
  return { w: w!, N: N!, df, sigLevel: sigLevel!, power, method: "Chi squared power calculation", note: "N is the number of observations" };
}

/**
 * Options for {@link pwrAnovaTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrAnovaTestOptions extends PwrCommon {
  /** Number of groups. */
  k?: number | null;
  /** Number of observations per group. */
  n?: number | null;
  /** Effect size f, or `"small"`, `"medium"`, `"large"`. */
  f?: EffectSize | null;
}

/**
 * Result of {@link pwrAnovaTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrAnovaTestResult {
  /** Number of groups. */
  k: number;
  /** Number of observations per group. */
  n: number;
  /** Effect size f. */
  f: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** A note on the sample size. */
  note: string;
  /** Description of the calculation. */
  method: string;
}

/**
 * Power of the F test of a balanced one-way analysis of variance, or the number of groups, sample size, effect size
 * or significance level for a given power. Equivalent to `pwr::pwr.anova.test()` in R.
 *
 * @example
 * ```ts
 * pwrAnovaTest({ k: 4, n: 20, f: 0.25 }).power; // 0.42039009037704295
 * pwrAnovaTest({ k: 4, f: 0.25, power: 0.8 }).n; // 44.59927432039623
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrAnovaTest(options: PwrAnovaTestOptions = {}): PwrAnovaTestResult {
  let { k, n, power } = options;
  let f = effect(options.f, "anov");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([k, n, f, power, sigLevel], "exactly one of k, n, f, power, and sig.level must be NULL");
  checkProbabilities(sigLevel, power);
  if (!isUnknown(f) && f < 0) throw new RangeError("f must be positive");
  if (!isUnknown(k) && k < 2) throw new RangeError("number of groups must be at least 2");
  if (!isUnknown(n) && n < 2) throw new RangeError("number of observations in each group must be at least 2");
  const powerOf = (k: number, n: number, f: number, sig: number): number => {
    const df1 = k - 1;
    const df2 = (n - 1) * k;
    return pf(qf(sig, df1, df2, { lowerTail: false }) as number, df1, df2, { ncp: k * n * f ** 2, lowerTail: false }) as number;
  };
  if (isUnknown(power)) power = powerOf(k!, n!, f!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(k)) k = solveFor((x) => powerOf(x, n!, f!, sigLevel!) - target, 2 + 1e-10, 100);
    else if (isUnknown(n)) n = solveFor((x) => powerOf(k!, x, f!, sigLevel!) - target, 2 + 1e-10, 1e9);
    else if (isUnknown(f)) f = solveFor((x) => powerOf(k!, n!, x, sigLevel!) - target, 1e-7, 1e7);
    else sigLevel = solveFor((x) => powerOf(k!, n!, f!, x) - target, 1e-10, 1 - 1e-10);
  }
  return {
    k: k!,
    n: n!,
    f: f!,
    sigLevel: sigLevel!,
    power,
    note: "n is number in each group",
    method: "Balanced one-way analysis of variance power calculation",
  };
}

/**
 * Options for {@link pwrF2Test}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrF2TestOptions extends PwrCommon {
  /** Degrees of freedom of the numerator. */
  u?: number | null;
  /** Degrees of freedom of the denominator. */
  v?: number | null;
  /** Effect size f², or `"small"`, `"medium"`, `"large"`. */
  f2?: EffectSize | null;
}

/**
 * Result of {@link pwrF2Test}.
 *
 * @category Effect sizes and power
 */
export interface PwrF2TestResult {
  /** Degrees of freedom of the numerator. */
  u: number;
  /** Degrees of freedom of the denominator. */
  v: number;
  /** Effect size f². */
  f2: number;
  /** Significance level (R's `sig.level`). */
  sigLevel: number;
  /** Power of the test. */
  power: number;
  /** Description of the calculation. */
  method: string;
}

/**
 * Power of the F test of a general linear model, or the degrees of freedom, effect size or significance level for a
 * given power. Equivalent to `pwr::pwr.f2.test()` in R.
 *
 * @example
 * ```ts
 * pwrF2Test({ u: 3, v: 60, f2: 0.15 }).power; // 0.7109605416866717
 * pwrF2Test({ u: 3, f2: 0.15, power: 0.8 }).v; // 72.70582657950871
 * ```
 *
 * @category Effect sizes and power
 */
export function pwrF2Test(options: PwrF2TestOptions = {}): PwrF2TestResult {
  let { u, v, power } = options;
  let f2 = effect(options.f2, "f2");
  let sigLevel = options.sigLevel === undefined ? 0.05 : options.sigLevel;
  checkExactlyOne([u, v, f2, power, sigLevel], "exactly one of u, v, f2, power, and sig.level must be NULL");
  checkProbabilities(sigLevel, power);
  if (!isUnknown(f2) && f2 < 0) throw new RangeError("f2 must be positive");
  if (!isUnknown(u) && u < 1) throw new RangeError("degree of freedom u for numerator must be at least 1");
  if (!isUnknown(v) && v < 1) throw new RangeError("degree of freedom v for denominator must be at least 1");
  const powerOf = (u: number, v: number, f2: number, sig: number): number =>
    pf(qf(sig, u, v, { lowerTail: false }) as number, u, v, { ncp: f2 * (u + v + 1), lowerTail: false }) as number;
  if (isUnknown(power)) power = powerOf(u!, v!, f2!, sigLevel!);
  else {
    const target = power;
    if (isUnknown(u)) u = solveFor((x) => powerOf(x, v!, f2!, sigLevel!) - target, 1 + 1e-10, 100);
    else if (isUnknown(v)) v = solveFor((x) => powerOf(u!, x, f2!, sigLevel!) - target, 1 + 1e-10, 1e9);
    else if (isUnknown(f2)) f2 = solveFor((x) => powerOf(u!, v!, x, sigLevel!) - target, 1e-7, 1e7);
    else sigLevel = solveFor((x) => powerOf(u!, v!, f2!, x) - target, 1e-10, 1 - 1e-10);
  }
  return { u: u!, v: v!, f2: f2!, sigLevel: sigLevel!, power, method: "Multiple regression power calculation" };
}
