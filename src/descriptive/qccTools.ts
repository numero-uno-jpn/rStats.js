// The tools around qcc's charts: operating characteristic curves (oc.curves), process capability
// (process.capability), multivariate T2 charts (mqcc), the overdispersion test (qcc.overdispersion.test), the Pareto
// table (pareto.chart), grouping (qcc.groups), and the median chart (Me-R) of ReactiveStat. Values only, no plots.
// Behaviour: oracle/qcc-bt-behaviour.md (clean room: from qcc's documentation, the papers it names and the output of R;
// no source of R or of a package was read). Written for rStats.js.
import { pnorm, qnorm } from "../distributions/normal.js";
import { ptukey, qtukey } from "../distributions/tukey.js";
import { pchisq, qchisq } from "../distributions/chisq.js";
import { pbinom } from "../distributions/binomial.js";
import { ppois } from "../distributions/poisson.js";
import { qf } from "../distributions/f.js";
import { qbeta } from "../distributions/beta.js";
import { chol, chol2inv } from "../linalg/chol.js";
import { mean as meanOf, median as medianOf } from "./basic.js";
import { c4, d2, d3, type QccResult } from "./qcc.js";
import { reported } from "../internal/warnings.js";

/**
 * Options for {@link ocCurves}.
 * @category Descriptive statistics
 */
export interface OcCurvesOptions {
  /** Group sizes of the curves (xbar, R, S; default the chart's size and 1 or 2, 5, 10, 15, 20). */
  n?: readonly number[];
  /** Shifts of the mean in sigma units (xbar) or ratios of the new sigma (R, S). */
  c?: readonly number[];
  /** The number of sigmas of the limits (default the chart's; probability limits when the chart has them). */
  nsigmas?: number;
}

/**
 * Result of {@link ocCurves}: the probability of not signalling (type II error) for a shift of the process.
 * @category Descriptive statistics
 */
export interface OcCurvesResult {
  /** The chart type. */
  type: QccResult["type"];
  /** xbar, R, S: one row per shift (`c`), one column per size (`n`). p, np, c, u: one value per point of `grid`. */
  beta: number[] | number[][];
  /** The shifts (xbar: of the mean in sigma units, R and S: ratios of sigma); empty for p, np, c, u. */
  c: number[];
  /** The group sizes of the columns; empty for p, np, c, u. */
  n: number[];
  /** p, np: the proportions 0, 0.01, ..., 1; c, u: the means 0, 1, ... of the counts; empty for xbar, R, S. */
  grid: number[];
  warnings: string[];
}

const seqLen = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
const uniq = (xs: readonly number[]): number[] => xs.filter((v, i) => xs.indexOf(v) === i);

/**
 * Operating characteristic curves of a chart (qcc's `oc.curves`): the probability that a group's statistic stays
 * within the limits after a shift. xbar: the normal model with limits `+- L` (L = nsigmas or the quantile of the
 * chart's confidence level); R and S: for each size its own limits (with sigma 1) under a scale change, from the
 * range distribution (ptukey) and chi-square; p and np: the binomial over p = 0, 0.01, ..., 1 with the chart's
 * limits; c: the Poisson over 0, 1, ..., ceiling(c + 10 sqrt(c)); u: the c curve of the counts (limits times n) over
 * 0, ..., ceiling(n u + 10 sqrt(u)). Equal group sizes only.
 *
 * @param chart a result of {@link qcc}
 * @category Descriptive statistics
 */
export function ocCurves(chart: QccResult, options: OcCurvesOptions = {}): OcCurvesResult {
  const type = chart.type;
  if (type === "xbar.one" || type === "g") throw new RangeError("Operating characteristic curves not available for this type of chart.");
  if (chart.sizes.some((n) => n !== chart.sizes[0])) throw new RangeError("Operating characteristic curves available only for equal sample sizes!");
  const size = chart.sizes[0]!;
  const conf = options.nsigmas === undefined ? chart.confidenceLevel : null;
  const nsig = options.nsigmas ?? chart.nsigmas ?? 3;
  const warnings: string[] = [];
  const done = (r: Omit<OcCurvesResult, "type" | "warnings">) => reported("ocCurves", { type, ...r, warnings });
  if (type === "xbar" || type === "R" || type === "S") {
    const n = options.n ? [...options.n] : uniq([size, type === "xbar" ? 1 : 2, 5, 10, 15, 20]);
    const c = options.c ? [...options.c] : type === "xbar" ? seqLen(0, 5, 101) : seqLen(1, 6, 101);
    const beta = c.map((cc) => n.map((k) => {
      if (type === "xbar") {
        const L = conf === null ? nsig : qnorm((1 + conf) / 2);
        return pnorm(L - cc * Math.sqrt(k)) - pnorm(-L - cc * Math.sqrt(k));
      }
      if (type === "R") {
        // the limits of a chart of size k with sigma 1 (probability limits from the range distribution)
        const lo = conf === null ? Math.max(0, d2(k) - nsig * d3(k)) : qtukey((1 - conf) / 2, k, Infinity);
        const hi = conf === null ? d2(k) + nsig * d3(k) : qtukey((1 + conf) / 2, k, Infinity);
        return ptukey(hi / cc, k, Infinity) - ptukey(lo / cc, k, Infinity);
      }
      if (conf !== null) {
        const lo = qchisq((1 - conf) / 2, k - 1), hi = qchisq((1 + conf) / 2, k - 1);
        return pchisq(hi / cc ** 2, k - 1) - pchisq(lo / cc ** 2, k - 1);
      }
      const w = nsig * Math.sqrt(1 - c4(k) ** 2);
      const hi = c4(k) + w, lo = Math.max(0, c4(k) - w);
      return pchisq((k - 1) * (hi / cc) ** 2, k - 1) - pchisq((k - 1) * (lo / cc) ** 2, k - 1);
    }));
    return done({ beta, c, n, grid: [] });
  }
  const lcl = chart.limits.lcl[0]!, ucl = chart.limits.ucl[0]!;
  if (type === "p" || type === "np") {
    warnings.push("Some computed values for the type II error have been rounded due to the discreteness of the binomial distribution. Thus, some ARL values might be meaningless.");
    const scale = type === "p" ? size : 1;
    const grid = seqLen(0, 1, 101);
    const beta = grid.map((p) => pbinom(Math.floor(scale * ucl), size, p) - pbinom(Math.ceil(scale * lcl) - 1, size, p));
    return done({ beta, c: [], n: [], grid });
  }
  warnings.push("Some computed values for the type II error have been rounded due to the discreteness of the Poisson distribution. Thus, some ARL values might be meaningless.");
  const center = chart.center as number;
  const scale = type === "u" ? size : 1;
  const top = Math.ceil(scale * center + 10 * Math.sqrt(center));
  const grid = Array.from({ length: top + 1 }, (_, i) => i);
  const beta = grid.map((l) => ppois(Math.floor(scale * ucl), l) - ppois(Math.ceil(scale * lcl) - 1, l));
  return done({ beta, c: [], n: [], grid });
}

/**
 * Options for {@link processCapability}.
 * @category Descriptive statistics
 */
export interface ProcessCapabilityOptions {
  /** The target (default the middle of the specification limits). */
  target?: number;
  /** The within-group standard deviation (default the chart's). */
  stdDev?: number;
  /** The number of sigmas (default the chart's). */
  nsigmas?: number;
  /** The level of the confidence intervals (default 0.95). */
  confidenceLevel?: number;
}

/**
 * Result of {@link processCapability}.
 * @category Descriptive statistics
 */
export interface ProcessCapabilityResult {
  /** The number of observations. */
  nobs: number;
  center: number;
  stdDev: number;
  target: number;
  /** [LSL, USL] (NaN for a missing one). */
  specLimits: [number, number];
  /** Cp, Cp_l, Cp_u, Cp_k, Cpm with their confidence limits. */
  indices: { names: string[]; value: number[]; lower: number[]; upper: number[]; level: number };
  /** The expected fractions below LSL and above USL under the normal model (values below 1e-4 as 0, as qcc). */
  exp: [number, number];
  /** The observed fractions below LSL and above USL. */
  obs: [number, number];
  warnings: string[];
}

/**
 * Process capability indices of an xbar or xbar.one chart (qcc's `process.capability`): Cp with Chou's limits, Cp_u and
 * Cp_k with Bissell's (the one-sided Cp_l and Cp_u with the one-sided quantile qnorm(conf)), Cpm with Boyles's
 * (nu = n (1 + d^2) / (1 + 2 d^2)). As qcc: with one specification limit missing, Cp, Cp_k and Cpm are NaN; expected fractions below 1e-4
 * are reported as 0.
 *
 * @param chart an xbar or xbar.one chart ({@link qcc})
 * @param specLimits [LSL, USL]; NaN for a one-sided specification
 * @category Descriptive statistics
 */
export function processCapability(chart: QccResult, specLimits: readonly [number, number] | readonly number[],
  options: ProcessCapabilityOptions = {}): ProcessCapabilityResult {
  if (chart.type !== "xbar" && chart.type !== "xbar.one") {
    throw new RangeError('Process Capability Analysis only available for charts type "xbar" and "xbar.one" charts');
  }
  if (specLimits.length !== 2) throw new RangeError("specLimits must be [LSL, USL]");
  const [lsl, usl] = [specLimits[0]!, specLimits[1]!];
  const x = chart.data.flat().filter((v) => !Number.isNaN(v));
  const n = x.length;
  const center = chart.center as number;
  const sd = options.stdDev ?? (chart.stdDev as number);
  const k = options.nsigmas ?? chart.nsigmas ?? 3;
  const conf = options.confidenceLevel ?? 0.95;
  const present = [lsl, usl].filter((v) => !Number.isNaN(v));
  const target = options.target ?? meanOf(present);
  const warnings: string[] = [];
  if (!(lsl <= target && target <= usl) && !Number.isNaN(lsl) && !Number.isNaN(usl)) {
    warnings.push("target value is not within specification limits...");
  }
  const a = 1 - conf, z = qnorm(1 - a / 2);
  // Bissell's limits in the multiplicative form e (1 -+ q sqrt(1 / (9 n e^2) + 1 / (2 (n - 1)))): for a negative index
  // (reversed specification limits) the lower limit is the larger number, as in qcc
  const bissell = (e: number, q: number) => {
    const w = q * Math.sqrt(1 / (9 * n * e * e) + 1 / (2 * (n - 1)));
    return [e * (1 - w), e * (1 + w)];
  };
  const cp = (usl - lsl) / (2 * k * sd);
  const cpl = (center - lsl) / (k * sd), cpu = (usl - center) / (k * sd);
  const both = !Number.isNaN(lsl) && !Number.isNaN(usl);
  const cpk = both ? Math.min(cpl, cpu) : NaN;
  const cpm = (usl - lsl) / (2 * k * Math.sqrt(sd * sd + (center - target) ** 2));
  const d = (center - target) / sd, nu = n * (1 + d * d) / (1 + 2 * d * d);
  const chi = (df: number) => [Math.sqrt(qchisq(a / 2, df) / df), Math.sqrt(qchisq(1 - a / 2, df) / df)];
  const cpCI = chi(n - 1).map((f) => cp * f), cpmCI = chi(nu).map((f) => cpm * f);
  // the one-sided indices Cp_l and Cp_u take the one-sided quantile qnorm(1 - a), Cp_k the two-sided one (as qcc)
  const cplCI = bissell(cpl, qnorm(1 - a)), cpuCI = bissell(cpu, qnorm(1 - a)), cpkCI = bissell(cpk, z);
  const value = [cp, cpl, cpu, cpk, cpm];
  const lower = [cpCI[0]!, cplCI[0]!, cpuCI[0]!, cpkCI[0]!, cpmCI[0]!];
  const upper = [cpCI[1]!, cplCI[1]!, cpuCI[1]!, cpkCI[1]!, cpmCI[1]!];
  // qcc: expected fractions below 1e-4 are reported as 0
  const cut = (p: number) => (p < 1e-4 ? 0 : p);
  const exp: [number, number] = [Number.isNaN(lsl) ? NaN : cut(pnorm(lsl, { mean: center, sd })),
    Number.isNaN(usl) ? NaN : cut(pnorm(usl, { mean: center, sd, lowerTail: false }))];
  const obs: [number, number] = [Number.isNaN(lsl) ? NaN : x.filter((v) => v < lsl).length / n,
    Number.isNaN(usl) ? NaN : x.filter((v) => v > usl).length / n];
  return reported("processCapability", {
    nobs: n, center, stdDev: sd, target, specLimits: [lsl, usl],
    indices: { names: ["Cp", "Cp_l", "Cp_u", "Cp_k", "Cpm"], value, lower, upper, level: conf },
    exp, obs, warnings,
  });
}

/**
 * Options for {@link mqcc}.
 * @category Descriptive statistics
 */
export interface MqccOptions {
  /** `"T2"` (subgrouped data, default when data is a list of matrices) or `"T2.single"` (one row per observation). */
  type?: "T2" | "T2.single";
  /** The center of the variables (default estimated). */
  center?: readonly number[];
  /** The covariance matrix of the variables (default estimated). */
  cov?: readonly (readonly number[])[];
  /** Compute the prediction (phase II) limits too (default false). */
  predLimits?: boolean;
  /** Further groups (rows) charted with the phase I center and covariance. */
  newdata?: readonly (readonly number[])[] | readonly (readonly (readonly number[])[])[];
  /** The confidence level of the limits (default (1 - 0.0027)^p). */
  confidenceLevel?: number;
}

/**
 * Result of {@link mqcc}.
 * @category Descriptive statistics
 */
export interface MqccResult {
  type: "T2" | "T2.single";
  /** Hotelling's T2 of each group (row) of data. */
  statistics: number[];
  /** T2 of each group of newdata. */
  newstatistics: number[];
  /** The group means (T2) or the rows (T2.single). */
  means: number[][];
  center: number[];
  cov: number[][];
  /** The phase I limits (LCL 0). */
  limits: { lcl: number; ucl: number };
  /** The prediction limits, or null. */
  predLimits: { lcl: number; ucl: number } | null;
  confidenceLevel: number;
  /** 1-based indices over data and newdata. */
  violations: { beyondLimits: number[]; beyondPredLimits: number[] };
  warnings: string[];
}

function inverse(S: readonly (readonly number[])[]): number[][] {
  return chol2inv(chol(S.map((r) => [...r])));
}
const quad = (v: readonly number[], A: readonly (readonly number[])[]): number => {
  let s = 0;
  for (let i = 0; i < v.length; i++) for (let j = 0; j < v.length; j++) s += v[i]! * A[i]![j]! * v[j]!;
  return s;
};
function covOf(rows: readonly (readonly number[])[]): number[][] {
  const m = rows.length, p = rows[0]!.length;
  const mu = Array.from({ length: p }, (_, j) => meanOf(rows.map((r) => r[j]!)));
  return Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) =>
    rows.reduce((s, r) => s + (r[a]! - mu[a]!) * (r[b]! - mu[b]!), 0) / (m - 1)));
}

/**
 * A multivariate control chart (qcc's `mqcc`): Hotelling's T2 of subgroup means (`"T2"`: data a list with one matrix
 * per variable, rows = groups) or of individual observations (`"T2.single"`: one row per observation, one column per
 * variable), with the phase I limits (F for T2, Beta for T2.single) and optionally the prediction limits.
 * @category Descriptive statistics
 */
export function mqcc(data: readonly (readonly number[])[] | readonly (readonly (readonly number[])[])[],
  options: MqccOptions = {}): MqccResult {
  const nested = Array.isArray((data as any)[0]?.[0]);
  const type = options.type ?? (nested ? "T2" : "T2.single");
  let means: number[][], center: number[], cov: number[][], m: number, n: number, p: number;
  const meansOfGroups = (vars: readonly (readonly (readonly number[])[])[]) =>
    vars[0]!.map((_, i) => vars.map((M) => meanOf(M[i]!)));
  if (type === "T2") {
    if (!nested) throw new TypeError('a "T2" chart needs one matrix (groups x observations) per variable');
    const vars = data as readonly (readonly (readonly number[])[])[];
    p = vars.length; m = vars[0]!.length; n = vars[0]![0]!.length;
    means = meansOfGroups(vars);
    center = options.center ? [...options.center] : Array.from({ length: p }, (_, j) => meanOf(means.map((r) => r[j]!)));
    if (options.cov) cov = options.cov.map((r) => [...r]);
    else {
      const covs = means.map((_, i) => covOf(Array.from({ length: n }, (_, t) => vars.map((M) => M[i]![t]!))));
      cov = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => meanOf(covs.map((C) => C[a]![b]!))));
    }
  } else {
    // a list of one-column matrices is the same as a matrix with one column per variable
    const rowsIn = nested ? (data as readonly (readonly (readonly number[])[])[])[0]!.map((_, i) =>
      (data as readonly (readonly (readonly number[])[])[]).map((M) => M[i]![0]!)) : (data as readonly (readonly number[])[]);
    means = rowsIn.map((r) => [...r]);
    p = means[0]!.length; m = means.length; n = 1;
    center = options.center ? [...options.center] : Array.from({ length: p }, (_, j) => meanOf(means.map((r) => r[j]!)));
    cov = options.cov ? options.cov.map((r) => [...r]) : covOf(means);
  }
  const inv = inverse(cov);
  const t2 = (v: readonly number[]) => n * quad(v.map((x, j) => x - center[j]!), inv);
  const statistics = means.map(t2);
  let newMeans: number[][] = [];
  if (options.newdata) {
    newMeans = type === "T2" ? meansOfGroups(options.newdata as readonly (readonly (readonly number[])[])[])
      : (options.newdata as readonly (readonly number[])[]).map((r) => [...r]);
  }
  const newstatistics = newMeans.map(t2);
  const conf = options.confidenceLevel ?? (1 - 0.0027) ** p;
  let ucl: number, pucl: number;
  if (type === "T2") {
    const df2 = m * n - m - p + 1;
    ucl = p * (m - 1) * (n - 1) / df2 * qf(conf, p, df2);
    pucl = p * (m + 1) * (n - 1) / df2 * qf(conf, p, df2);
  } else {
    ucl = (m - 1) ** 2 / m * qbeta(conf, p / 2, (m - p - 1) / 2);
    pucl = p * (m + 1) * (m - 1) / (m * (m - p)) * qf(conf, p, m - p);
  }
  const all = [...statistics, ...newstatistics];
  const beyondLimits = all.flatMap((v, i) => (v > ucl ? [i + 1] : []));
  const beyondPredLimits = options.predLimits ? all.flatMap((v, i) => (v > pucl ? [i + 1] : [])) : [];
  return reported("mqcc", {
    type, statistics, newstatistics, means, center, cov, limits: { lcl: 0, ucl },
    predLimits: options.predLimits ? { lcl: 0, ucl: pucl } : null, confidenceLevel: conf,
    violations: { beyondLimits, beyondPredLimits }, warnings: [],
  });
}

/**
 * Options for {@link qccOverdispersionTest}.
 * @category Descriptive statistics
 */
export interface QccOverdispersionTestOptions {
  /** The sample sizes (binomial data). */
  size?: number | readonly number[];
  /** `"binomial"` (default when sizes are given) or `"poisson"`. */
  type?: "binomial" | "poisson";
}

/**
 * Result of {@link qccOverdispersionTest}.
 * @category Descriptive statistics
 */
export interface QccOverdispersionTestResult {
  type: "binomial" | "poisson";
  /** The observed variance over the theoretical variance. */
  ratio: number;
  /** ratio (k - 1). */
  statistic: number;
  df: number;
  /** 1 - pchisq(statistic, df) (qcc rounds it to 5 significant digits; this is the full value). */
  pValue: number;
}

/**
 * The overdispersion test for binomial or Poisson counts (qcc's `qcc.overdispersion.test`): D = var(x) / theoretical
 * variance * (k - 1) against chi-square on k - 1 degrees of freedom; the theoretical variance is mean(size) p (1 - p)
 * with p = sum(x) / sum(size), or mean(x).
 * @category Descriptive statistics
 */
export function qccOverdispersionTest(x: readonly number[], options: QccOverdispersionTestOptions = {}): QccOverdispersionTestResult {
  const type = options.type ?? (options.size === undefined ? "poisson" : "binomial");
  const k = x.length, m = meanOf(x);
  const v = x.reduce((s, u) => s + (u - m) ** 2, 0) / (k - 1);
  let theory: number;
  if (type === "binomial") {
    if (options.size === undefined) throw new TypeError("size must be given for binomial data");
    const size = typeof options.size === "number" ? new Array<number>(k).fill(options.size) : [...options.size];
    const p = x.reduce((a, b) => a + b, 0) / size.reduce((a, b) => a + b, 0);
    theory = meanOf(size) * p * (1 - p);
  } else theory = m;
  const ratio = v / theory, statistic = ratio * (k - 1);
  return { type, ratio, statistic, df: k - 1, pValue: pchisq(statistic, k - 1, { lowerTail: false }) };
}

/**
 * Result of {@link paretoChart}.
 * @category Descriptive statistics
 */
export interface ParetoChartResult {
  /** The categories in decreasing order of frequency (ties in the given order). */
  names: string[];
  frequency: number[];
  cumFrequency: number[];
  percentage: number[];
  cumPercentage: number[];
}

/**
 * The table of a Pareto chart (qcc's `pareto.chart`, without the plot): frequencies in decreasing order with the
 * cumulative frequencies and percentages. Unnamed data are named A, B, C, ...
 * @category Descriptive statistics
 */
export function paretoChart(data: readonly number[] | Readonly<Record<string, number>>, names?: readonly string[]): ParetoChartResult {
  const values = Array.isArray(data) ? [...(data as readonly number[])] : Object.values(data as Record<string, number>);
  const labels = names ? [...names] : Array.isArray(data) ? values.map((_, i) => letterName(i)) : Object.keys(data);
  const order = values.map((_, i) => i).sort((i, j) => values[j]! - values[i]! || i - j);
  const total = values.reduce((a, b) => a + b, 0);
  const frequency = order.map((i) => values[i]!);
  let acc = 0;
  const cumFrequency = frequency.map((v) => (acc += v));
  return {
    names: order.map((i) => labels[i]!), frequency, cumFrequency,
    percentage: frequency.map((v) => v / total * 100), cumPercentage: cumFrequency.map((v) => v / total * 100),
  };
}
function letterName(i: number): string {
  let s = "", k = i + 1;
  while (k > 0) { const r = (k - 1) % 26; s = String.fromCharCode(65 + r) + s; k = Math.floor((k - 1) / 26); }
  return s;
}

/**
 * Result of {@link qccGroups}.
 * @category Descriptive statistics
 */
export interface QccGroupsResult {
  /** The sample values, sorted: the names of the rows. */
  names: string[];
  /** One row per sample, the values in order of appearance, NaN to fill. */
  groups: number[][];
}

/**
 * Groups data by a sample indicator into one row per sample (qcc's `qcc.groups`), for {@link qcc}.
 * @category Descriptive statistics
 */
export function qccGroups(data: readonly number[], sample: readonly (number | string)[]): QccGroupsResult {
  if (data.length !== sample.length) throw new RangeError("data and sample must have the same length");
  const keys = [...new Set(sample)];
  keys.sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
  const rows = keys.map((k) => data.filter((_, i) => sample[i] === k));
  const width = Math.max(...rows.map((r) => r.length));
  return { names: keys.map(String), groups: rows.map((r) => [...r, ...new Array<number>(width - r.length).fill(NaN)]) };
}

/**
 * Result of {@link medianChart}.
 * @category Descriptive statistics
 */
export interface MedianChartResult {
  /** The groups in order of first appearance. */
  groups: string[];
  /** The group size. */
  n: number;
  medians: number[];
  ranges: number[];
  /** The median chart: center (mean of the medians) and limits center +- A4 Rbar. */
  median: { center: number; lcl: number; ucl: number; outOfControl: number[] };
  /** The range chart: center Rbar and limits D3 Rbar, D4 Rbar. */
  range: { center: number; lcl: number; ucl: number; outOfControl: number[] };
}

// The 3-sigma factors of the median (A4) and range (D3, D4) charts for group sizes 2..10 (JIS)
const A4 = [1.880, 1.187, 0.796, 0.691, 0.549, 0.509, 0.432, 0.412, 0.363];
const D3 = [0, 0, 0, 0, 0, 0.076, 0.136, 0.184, 0.223];
const D4 = [3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777];

/**
 * The median chart (Me-R chart) of subgroups of equal size 2 to 10, with the JIS factors A4, D3, D4: medians charted
 * around the mean median with limits `+- A4 Rbar`, ranges around Rbar with limits `D3 Rbar`, `D4 Rbar` (the procedure of
 * ReactiveStat; not in qcc). Unequal group sizes are an error.
 *
 * @param values the observations
 * @param groups the subgroup of each observation (groups in order of first appearance)
 * @category Descriptive statistics
 */
export function medianChart(values: readonly number[], groups: readonly (string | number)[]): MedianChartResult {
  if (values.length !== groups.length) throw new RangeError("values and groups must have the same length");
  const keys = [...new Set(groups.map(String))];
  const data = keys.map((k) => values.filter((_, i) => String(groups[i]) === k));
  const n = data[0]!.length;
  if (data.some((g) => g.length !== n)) throw new RangeError("the groups must all have the same size");
  if (n < 2 || n > 10) throw new RangeError("the group size must be between 2 and 10");
  const medians = data.map((g) => medianOf(g));
  const ranges = data.map((g) => Math.max(...g) - Math.min(...g));
  const me = meanOf(medians), rbar = meanOf(ranges);
  const a4 = A4[n - 2]!, d3 = D3[n - 2]!, d4 = D4[n - 2]!;
  const out = (x: readonly number[], lo: number, hi: number) => x.flatMap((v, i) => (v > hi || v < lo ? [i + 1] : []));
  const mLcl = me - a4 * rbar, mUcl = me + a4 * rbar, rLcl = d3 * rbar, rUcl = d4 * rbar;
  return {
    groups: keys, n, medians, ranges,
    median: { center: me, lcl: mLcl, ucl: mUcl, outOfControl: out(medians, mLcl, mUcl) },
    range: { center: rbar, lcl: rLcl, ucl: rUcl, outOfControl: out(ranges, rLcl, rUcl) },
  };
}
