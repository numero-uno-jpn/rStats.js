// Shewhart control charts (qcc's qcc and shewhart.rules), the cusum and ewma charts and ewmaSmooth: the values only,
// no plots. Behaviour: oracle/qcc-bt-behaviour.md (clean room: from qcc's documentation, the textbook definitions it
// names and the output of R; no source of R or of a package was read). Written for rStats.js.
import { lgamma } from "../special/gamma.js";
import { qnorm } from "../distributions/normal.js";
import { qtukey } from "../distributions/tukey.js";
import { qchisq } from "../distributions/chisq.js";
import { qbinom } from "../distributions/binomial.js";
import { qpois } from "../distributions/poisson.js";
import { qgeom } from "../distributions/geometric.js";
import { mean as meanOf, sd as sdOf } from "./basic.js";
import { Warnings, reported, withWarnings, warn } from "../internal/warnings.js";

/**
 * The type of a Shewhart chart (qcc's `type`): group means `"xbar"`, ranges `"R"`, standard deviations `"S"`,
 * individual values `"xbar.one"`, proportion `"p"` and number `"np"` of nonconforming units, nonconformities `"c"` and
 * nonconformities per unit `"u"`, and the number of non-events between events `"g"`.
 * @category Descriptive statistics
 */
export type QccType = "xbar" | "R" | "S" | "xbar.one" | "p" | "np" | "c" | "u" | "g";

/**
 * A method of estimating the process standard deviation (qcc's `std.dev`): from the group ranges `"UWAVE-R"`,
 * `"MVLUE-R"`, from the group standard deviations `"UWAVE-SD"`, `"MVLUE-SD"`, `"RMSDF"` (grouped data), from the moving
 * ranges `"MR"` or the standard deviation `"SD"` (individual values).
 * @category Descriptive statistics
 */
export type QccStdDevMethod = "UWAVE-R" | "UWAVE-SD" | "MVLUE-R" | "MVLUE-SD" | "RMSDF" | "MR" | "SD";

/**
 * Data of a control chart: one value per group (a vector), or one row per group (a matrix as an array of rows; `null`
 * or `NaN` for a missing value, so that the groups may differ in size).
 * @category Descriptive statistics
 */
export type QccData = readonly (number | null)[] | readonly (readonly (number | null)[])[];

/**
 * Options for {@link qcc}.
 * @category Descriptive statistics
 */
export interface QccOptions {
  /** The chart (required). */
  type: QccType;
  /**
   * The group sizes: one number for all groups or one per group. Required for `"p"`, `"np"` and `"u"`; for a matrix
   * the sizes are the numbers of non-missing values of the rows.
   */
  sizes?: number | readonly number[];
  /** The center (target) of the statistic; estimated from the data when not given. */
  center?: number;
  /**
   * The process standard deviation, or the method that estimates it. Defaults: `"UWAVE-R"` for xbar (`"RMSDF"` when a
   * group is larger than 25, as qcc) and R, `"UWAVE-SD"` for S, `"MR"` for xbar.one.
   */
  stdDev?: number | QccStdDevMethod;
  /** Control limits `[LCL, UCL]` to use instead of computing them. */
  limits?: readonly [number, number];
  /** Further groups charted with the center, standard deviation and limits of `data` (qcc's `newdata`). */
  newdata?: QccData;
  /** The sizes of the groups of `newdata` (default: as `sizes` when that is one number). */
  newsizes?: number | readonly number[];
  /** Labels of the groups (and of the groups of `newdata`, `newlabels`). */
  labels?: readonly string[];
  /** Labels of the groups of `newdata`. */
  newlabels?: readonly string[];
  /** The number of standard deviations of the limits (default 3); ignored when `confidenceLevel` is given. */
  nsigmas?: number;
  /** A probability in (0, 1): probability limits at this level instead of `nsigmas`. */
  confidenceLevel?: number;
  /** The length of a run on one side of the center that signals (default 7, qcc's `run.length` option). */
  runLength?: number;
  /** The number of points of the moving ranges for xbar.one with `"MR"` (default 2, qcc's `k`). */
  k?: number;
}

/**
 * The points out of control (qcc's `violations`): 1-based indices over the groups of `data` followed by those of
 * `newdata`.
 * @category Descriptive statistics
 */
export interface QccViolations {
  /** The points above the upper limit, in order, then those below the lower limit (as qcc). */
  beyondLimits: number[];
  /** The points that are the `runLength`-th or a later point of a run strictly on one side of the center. */
  violatingRuns: number[];
}

/**
 * Result of {@link qcc}.
 * @category Descriptive statistics
 */
export interface QccResult {
  /** The chart. */
  type: QccType;
  /** The charted statistic of each group of `data`. */
  statistics: number[];
  /** The group sizes. */
  sizes: number[];
  /** The center: one number, or one per group for an np chart with unequal sizes. */
  center: number | number[];
  /** The process standard deviation (one per group for an np chart with unequal sizes). */
  stdDev: number | number[];
  /** The method that estimated `stdDev`, or `null` when it was given or follows from the center. */
  stdDevMethod: QccStdDevMethod | null;
  /**
   * The control limits: one pair when all groups (of `data` and `newdata`) have the same size, else one pair per group
   * of `data` followed by those of `newdata`.
   */
  limits: { lcl: number[]; ucl: number[] };
  /** `nsigmas`, or `null` for probability limits. */
  nsigmas: number | null;
  /** The level of probability limits, or `null`. */
  confidenceLevel: number | null;
  /** The statistic of each group of `newdata` (empty without newdata). */
  newstatistics: number[];
  /** The sizes of the groups of `newdata`. */
  newsizes: number[];
  /** Labels of the groups (and of newdata), or `null`. */
  labels: string[] | null;
  /** The points out of control. */
  violations: QccViolations;
  /** The data of the chart, as groups (one value per group for vector data); used by {@link processCapability}. */
  data: number[][];
  /** The run length used for `violations`. */
  runLength: number;
  /** R's warnings. */
  warnings: string[];
}

// d2 (expected relative range) and d3 (its standard error) for group sizes 1..25 and 1..50: the values of
// qcc.options("exp.R.unscaled") and qcc.options("se.R.unscaled") (the published table values; d2 stops at 25 in qcc)
const D2 = [NaN, 1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.97, 3.078, 3.173, 3.258, 3.336, 3.407, 3.472, 3.532,
  3.588, 3.64, 3.689, 3.735, 3.778, 3.819, 3.858, 3.895, 3.931];
const D3 = [NaN, 0.8525033, 0.8883697, 0.8798108, 0.8640855, 0.8480442, 0.8332108, 0.8198378, 0.8078413, 0.7970584,
  0.787323, 0.7784873, 0.7704257, 0.763033, 0.7562217, 0.7499188, 0.7440627, 0.7386021, 0.7334929, 0.728698, 0.7241851,
  0.7199267, 0.7158987, 0.7120802, 0.7084528, 0.7050004, 0.7017086, 0.6985648, 0.6955576, 0.692677, 0.6899137,
  0.6872596, 0.6847074, 0.6822502, 0.6798821, 0.6775973, 0.675391, 0.6732584, 0.6711952, 0.6691976, 0.6672619,
  0.6653848, 0.6635632, 0.6617943, 0.6600754, 0.6584041, 0.656778, 0.655195, 0.6536532, 0.6521506];

/** d2(n), NaN outside the table (n above 25, as qcc) */
export function d2(n: number): number {
  return Number.isInteger(n) && n >= 1 && n < D2.length ? D2[n - 1]! : NaN;
}
/** d3(n), NaN outside the table (n above 50) */
export function d3(n: number): number {
  return Number.isInteger(n) && n >= 1 && n < D3.length ? D3[n - 1]! : NaN;
}
/** c4(n) = sqrt(2 / (n - 1)) Gamma(n / 2) / Gamma((n - 1) / 2) */
export function c4(n: number): number {
  return Math.sqrt(2 / (n - 1)) * Math.exp(lgamma(n / 2) - lgamma((n - 1) / 2));
}

const num = (v: number | null | undefined): number => (v === null || v === undefined ? NaN : v);
const isMatrix = (d: QccData): d is readonly (readonly (number | null)[])[] => d.length > 0 && Array.isArray(d[0]);

/** The groups of a data set: rows of a matrix (missing values dropped) or one value per group */
function groupsOf(d: QccData): number[][] {
  if (isMatrix(d)) return d.map((row) => row.map(num).filter((v) => !Number.isNaN(v)));
  return (d as readonly (number | null)[]).map((v) => [num(v)]);
}

function sizesOf(given: number | readonly number[] | undefined, count: number, what: string): number[] | undefined {
  if (given === undefined) return undefined;
  if (typeof given === "number") return new Array<number>(count).fill(given);
  if (given.length !== count) throw new RangeError(`${what} must have one value per group`);
  return [...given];
}

const range = (g: readonly number[]): number => (g.length === 0 ? NaN : Math.max(...g) - Math.min(...g));
const sdGroup = (g: readonly number[]): number => (g.length > 1 ? sdOf(g) : NaN);

/** The charted statistic of each group */
function statisticsOf(type: QccType, groups: readonly number[][], sizes: readonly number[]): number[] {
  switch (type) {
    case "xbar": return groups.map((g) => (g.length === 0 ? NaN : meanOf(g)));
    case "R": return groups.map(range);
    case "S": return groups.map(sdGroup);
    case "p": case "u": return groups.map((g, i) => g[0]! / sizes[i]!);
    default: return groups.map((g) => g[0]!);
  }
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const weighted = (x: readonly number[], w: readonly number[]): number => sum(x.map((v, i) => v * w[i]!)) / sum(w);

/** The grouped-data estimates of sigma (SAS/QC's definitions, named in qcc's help of sd.xbar) */
function groupedStdDev(method: QccStdDevMethod, groups: readonly number[][]): number {
  const n = groups.map((g) => g.length);
  switch (method) {
    case "UWAVE-R": return meanOf(groups.map((g, i) => range(g) / d2(n[i]!)));
    case "MVLUE-R": {
      const f = n.map((k) => (d2(k) / d3(k)) ** 2);
      return weighted(groups.map((g, i) => range(g) / d2(n[i]!)), f);
    }
    case "UWAVE-SD": return meanOf(groups.map((g, i) => sdGroup(g) / c4(n[i]!)));
    case "MVLUE-SD": {
      const h = n.map((k) => c4(k) ** 2 / (1 - c4(k) ** 2));
      return weighted(groups.map((g, i) => sdGroup(g) / c4(n[i]!)), h);
    }
    case "RMSDF": {
      // the pooled standard deviation is formed from the group variances scaled by their largest standard deviation,
      // so that it does not overflow or underflow where the data are in range
      const s = groups.map(sdGroup), m = Math.max(...s.map(Math.abs));
      const df = sum(n.map((k) => k - 1));
      if (m === 0) return 0;
      return m * Math.sqrt(sum(s.map((v, i) => (n[i]! - 1) * (v / m) ** 2)) / df) / c4(df + 1);
    }
    default: throw new RangeError(`unknown std.dev method "${method}"`);
  }
}

/** xbar.one's estimates: moving ranges of k points / d2(k), or sd(x) / c4(n) */
function individualStdDev(method: QccStdDevMethod, x: readonly number[], k: number): number {
  const v = x.filter((u) => !Number.isNaN(u));
  if (method === "SD") return sdOf(v) / c4(v.length);
  if (method !== "MR") throw new RangeError("'arg' should be one of “MR”, “SD”");
  const ranges: number[] = [];
  for (let i = 0; i + k <= x.length; i++) {
    const w = x.slice(i, i + k);
    if (w.some(Number.isNaN)) continue;
    ranges.push(range(w));
  }
  return meanOf(ranges) / d2(k);
}

const ALLOWED: Partial<Record<QccType, QccStdDevMethod[]>> = {
  xbar: ["UWAVE-R", "UWAVE-SD", "MVLUE-R", "MVLUE-SD", "RMSDF"],
  R: ["UWAVE-R", "MVLUE-R"],
  S: ["UWAVE-SD", "MVLUE-SD", "RMSDF"],
  "xbar.one": ["MR", "SD"],
};

function argError(allowed: readonly string[]): RangeError {
  return new RangeError(`'arg' should be one of ${allowed.map((a) => `“${a}”`).join(", ")}`);
}

/** The center and sigma of a chart (sigma per group for np with unequal sizes) */
interface CenterSd { center: number | number[]; sd: number | number[]; method: QccStdDevMethod | null }

function centerAndSd(type: QccType, stats: readonly number[], groups: readonly number[][], sizes: readonly number[],
  options: QccOptions): CenterSd {
  const given = options.stdDev;
  const k = options.k ?? 2;
  switch (type) {
    case "xbar": case "R": case "S": {
      const allowed = ALLOWED[type]!;
      let method: QccStdDevMethod | null = null;
      if (typeof given === "string") {
        if (!allowed.includes(given)) throw argError(allowed);
        method = given;
      } else if (given === undefined) {
        // qcc: the xbar chart switches to RMSDF for groups larger than 25 (no d2 there), without a message
        method = type === "S" ? "UWAVE-SD" : type === "xbar" && sizes.some((n) => n > 25) ? "RMSDF" : "UWAVE-R";
      }
      if (method !== null && sizes.some((n) => n < 2)) throw new RangeError("group sizes must be larger than one");
      const sd = typeof given === "number" ? given : groupedStdDev(method!, groups);
      const center = options.center ?? weighted(stats, sizes);
      return { center, sd, method };
    }
    case "xbar.one": {
      let method: QccStdDevMethod | null = null;
      if (typeof given === "string") {
        if (!ALLOWED["xbar.one"]!.includes(given)) throw argError(ALLOWED["xbar.one"]!);
        method = given;
      } else if (given === undefined) method = "MR";
      const x = groups.map((g) => g[0]!);
      const sd = typeof given === "number" ? given : individualStdDev(method!, x, k);
      return { center: options.center ?? meanOf(x.filter((v) => !Number.isNaN(v))), sd, method };
    }
    case "p": {
      const p = sum(groups.map((g) => g[0]!)) / sum(sizes);
      return { center: options.center ?? p, sd: typeof given === "number" ? given : Math.sqrt(p * (1 - p)), method: null };
    }
    case "np": {
      const p = sum(groups.map((g) => g[0]!)) / sum(sizes);
      const equal = sizes.every((n) => n === sizes[0]);
      const center = options.center ?? (equal ? sizes[0]! * p : sizes.map((n) => n * p));
      const sd = typeof given === "number" ? given
        : equal ? Math.sqrt(sizes[0]! * p * (1 - p)) : sizes.map((n) => Math.sqrt(n * p * (1 - p)));
      return { center, sd, method: null };
    }
    case "c": {
      const c = meanOf(stats);
      return { center: options.center ?? c, sd: typeof given === "number" ? given : Math.sqrt(c), method: null };
    }
    case "u": {
      const u = sum(groups.map((g) => g[0]!)) / sum(sizes);
      return { center: options.center ?? u, sd: typeof given === "number" ? given : Math.sqrt(u), method: null };
    }
    case "g": {
      const g = meanOf(stats);
      return { center: options.center ?? g, sd: typeof given === "number" ? given : Math.sqrt(g * (g - 1)), method: null };
    }
  }
}

const at = (v: number | number[], i: number): number => (typeof v === "number" ? v : v[i]!);

/** The limits at the sizes given (one pair per size) */
function limitsAt(type: QccType, center: number | number[], sd: number | number[], sizes: readonly number[],
  nsigmas: number, conf: number | null): { lcl: number[]; ucl: number[] } {
  const lo = conf === null ? NaN : (1 - conf) / 2, hi = conf === null ? NaN : (1 + conf) / 2;
  const lcl: number[] = [], ucl: number[] = [];
  const push = (l: number, u: number) => { lcl.push(l); ucl.push(u); };
  sizes.forEach((n, i) => {
    const c = at(center, i), s = at(sd, i);
    switch (type) {
      case "xbar": {
        const z = conf === null ? nsigmas : qnorm(hi);
        push(c - z * s / Math.sqrt(n), c + z * s / Math.sqrt(n));
        break;
      }
      case "xbar.one": {
        const z = conf === null ? nsigmas : qnorm(hi);
        push(c - z * s, c + z * s);
        break;
      }
      case "R": {
        if (conf === null) {
          if (n > 50) throw new RangeError("group size must be less than 51 when giving nsigmas");
          push(Math.max(0, c - nsigmas * d3(n) * s), c + nsigmas * d3(n) * s);
        } else push(qtukey(lo, n, Infinity) * s, qtukey(hi, n, Infinity) * s);
        break;
      }
      case "S": {
        if (conf === null) {
          const w = nsigmas * s * Math.sqrt(1 - c4(n) ** 2);
          push(Math.max(0, c - w), c + w);
        } else push(s * Math.sqrt(qchisq(lo, n - 1) / (n - 1)), s * Math.sqrt(qchisq(hi, n - 1) / (n - 1)));
        break;
      }
      case "p": {
        // the limits follow from the center (also a given center), not from the std.dev reported
        if (conf === null) {
          const w = nsigmas * Math.sqrt(c * (1 - c) / n);
          push(Math.max(0, c - w), Math.min(1, c + w));
        } else push(qbinom(lo, n, c) / n, qbinom(hi, n, c) / n);
        break;
      }
      case "np": {
        const p = c / n;
        if (conf === null) {
          const w = nsigmas * Math.sqrt(c * (1 - p));
          push(Math.max(0, c - w), c + w);
        } else push(qbinom(lo, n, p), qbinom(hi, n, p));
        break;
      }
      case "c": {
        if (conf === null) push(Math.max(0, c - nsigmas * Math.sqrt(c)), c + nsigmas * Math.sqrt(c));
        else push(qpois(lo, c), qpois(hi, c));
        break;
      }
      case "u": {
        if (conf === null) {
          const w = nsigmas * Math.sqrt(c / n);
          push(Math.max(0, c - w), c + w);
        } else push(qpois(lo, c * n) / n, qpois(hi, c * n) / n);
        break;
      }
      case "g": {
        if (conf === null) push(Math.max(0, c - nsigmas * s), c + nsigmas * s);
        else push(qgeom(lo, 1 / c), qgeom(hi, 1 / c));
        break;
      }
    }
  });
  return { lcl, ucl };
}

/**
 * The points out of control (qcc's `shewhart.rules`: `beyond.limits` and `violating.runs`) of statistics charted
 * with a center and limits (one pair for all points, or one per point). An NA statistic is left out of both lists
 * (qcc puts NA into them) and ends a run.
 * @category Descriptive statistics
 */
export function shewhartRules(statistics: readonly number[], center: number | readonly number[],
  limits: { lcl: readonly number[]; ucl: readonly number[] }, options: { runLength?: number } = {}): QccViolations {
  const runLength = options.runLength ?? 7;
  const lim = (i: number): [number, number] =>
    limits.lcl.length === 1 ? [limits.lcl[0]!, limits.ucl[0]!] : [limits.lcl[i]!, limits.ucl[i]!];
  const above: number[] = [], below: number[] = [], runs: number[] = [];
  let side = 0, length = 0;
  statistics.forEach((v, i) => {
    const [l, u] = lim(i);
    if (v > u) above.push(i + 1);
    if (v < l) below.push(i + 1);
    const c = typeof center === "number" ? center : center[i]!;
    const s = Number.isNaN(v) ? 0 : Math.sign(v - c);
    if (s !== 0 && s === side) length++;
    else { side = s; length = s === 0 ? 0 : 1; }
    if (length >= runLength) runs.push(i + 1);
  });
  return { beyondLimits: [...above, ...below], violatingRuns: runs };
}

const GEOM_WARNING = "The Geometric distribution is quite skewed, it is better to set conf at the required confidence level (0 < conf < 1) instead of as a multiplier of sigma.";

/**
 * A Shewhart control chart (qcc's `qcc`, without the plot): the charted statistics, the center, the process standard
 * deviation, the control limits and the points out of control.
 *
 * - xbar, R, S: data one row per group; sigma by UWAVE-R (default), MVLUE-R, UWAVE-SD, MVLUE-SD or RMSDF, the
 *   centers weighted by the group sizes; R limits `center +- k d3(n) sigma`, S limits `center +- k sigma
 *   sqrt(1 - c4(n)^2)`; probability limits from the range distribution (qtukey) and from chi-square.
 * - xbar.one: individual values, sigma from moving ranges (MR) or the standard deviation (SD).
 * - p, np, c, u, g: counts; limits from the binomial, Poisson and geometric models.
 *
 * As qcc: a group of size 1 is an error when sigma is estimated; groups larger than 25 switch the default of the xbar
 * chart to RMSDF and give NA limits for the R chart (no d2 / d3 there); unequal sizes are an error for the c chart.
 * Unlike qcc, NA statistics are left out of the violation indices.
 *
 * @param data one value per group, or one row per group
 * @param options the chart `type` and the options of qcc
 * @category Descriptive statistics
 */
export function qcc(data: QccData, options: QccOptions): QccResult {
  const sink = new Warnings();
  const result = withWarnings(sink, () => fitQcc(data, options));
  return reported("qcc", { ...result, warnings: sink.list });
}

function fitQcc(data: QccData, options: QccOptions): Omit<QccResult, "warnings"> {
  const type = options.type;
  if (!["xbar", "R", "S", "xbar.one", "p", "np", "c", "u", "g"].includes(type)) throw new RangeError(`unknown chart type "${type}"`);
  const grouped = type === "xbar" || type === "R" || type === "S";
  if (grouped && !isMatrix(data)) throw new TypeError(`a "${type}" chart needs one row per group`);
  if (!grouped && isMatrix(data)) throw new TypeError(`a "${type}" chart needs one value per group`);
  const groups = groupsOf(data);
  if (groups.length === 0) throw new RangeError("no data");
  let sizes: number[];
  if (grouped) sizes = groups.map((g) => g.length);
  else if (type === "p" || type === "np" || type === "u") {
    const s = sizesOf(options.sizes, groups.length, "sizes");
    if (s === undefined) throw new TypeError(`sample 'sizes' must be given for a ${type} chart`);
    sizes = s;
  } else sizes = sizesOf(options.sizes, groups.length, "sizes") ?? new Array<number>(groups.length).fill(1);
  if (type === "c" && sizes.some((n) => n !== sizes[0])) throw new RangeError("all sizes must be be equal for a c chart");
  const statistics = statisticsOf(type, groups, sizes);

  let newstatistics: number[] = [], newsizes: number[] = [], newGroups: number[][] = [];
  if (options.newdata !== undefined) {
    if (grouped !== isMatrix(options.newdata)) throw new TypeError("newdata must have the form of data");
    newGroups = groupsOf(options.newdata);
    if (grouped) newsizes = newGroups.map((g) => g.length);
    else {
      const ns = sizesOf(options.newsizes ?? (typeof options.sizes === "number" ? options.sizes : undefined),
        newGroups.length, "newsizes");
      if (ns === undefined && (type === "p" || type === "np" || type === "u")) throw new TypeError("'newsizes' must be given for newdata");
      newsizes = ns ?? new Array<number>(newGroups.length).fill(1);
    }
    newstatistics = statisticsOf(type, newGroups, newsizes);
  }

  const { center, sd, method } = centerAndSd(type, statistics, groups, sizes, options);
  const conf = options.confidenceLevel ?? null;
  if (conf !== null && !(conf > 0 && conf < 1)) throw new RangeError("confidenceLevel must be in (0, 1)");
  const nsigmas = options.nsigmas ?? 3;
  if (type === "g" && conf === null) warn(GEOM_WARNING);

  const allSizes = [...sizes, ...newsizes];
  const equal = allSizes.every((n) => n === allSizes[0]);
  let limits: { lcl: number[]; ucl: number[] };
  if (options.limits !== undefined) limits = { lcl: [options.limits[0]], ucl: [options.limits[1]] };
  else if (type === "np" && !equal) {
    // the np chart with unequal sizes: center and sigma per group of data; newdata at the pooled proportion
    const p = (typeof center === "number" ? center / sizes[0]! : center[0]! / sizes[0]!);
    const centers = allSizes.map((n) => n * p);
    limits = limitsAt(type, centers, centers, allSizes, nsigmas, conf);
  } else {
    // qcc gives the p chart one pair of limits per group also when the sizes are equal (and fails for its probability
    // limits then; rStats.js gives them)
    const one = equal && type !== "p";
    limits = limitsAt(type, center, sd, one ? [allSizes[0]!] : allSizes, nsigmas, conf);
  }
  // R chart beyond the d3 table, or with sigma NA: NA limits (qcc's)
  const runLength = options.runLength ?? 7;
  const allStats = [...statistics, ...newstatistics];
  const centerAll = typeof center === "number" ? center
    : [...center, ...newsizes.map((n) => n * (center[0]! / sizes[0]!))];
  const violations = shewhartRules(allStats, centerAll, limits, { runLength });
  const labels = options.labels === undefined ? null
    : [...options.labels, ...(options.newlabels ?? [])];
  return {
    type, statistics, sizes, center, stdDev: sd, stdDevMethod: method, limits,
    nsigmas: conf === null ? nsigmas : null, confidenceLevel: conf, newstatistics, newsizes, labels, violations,
    data: groups, runLength,
  };
}

/**
 * Options for {@link cusum}.
 * @category Descriptive statistics
 */
export interface CusumOptions {
  /** The group sizes (individual values: 1). */
  sizes?: number | readonly number[];
  /** The target (default: the center of the xbar or xbar.one chart of the data). */
  center?: number;
  /** The process standard deviation or the method that estimates it (as {@link qcc}). */
  stdDev?: number | QccStdDevMethod;
  /** The initial cumulative sums, in standard errors (default 0; must be in [0, decisionInterval)). */
  headStart?: number;
  /** The number of standard errors at which a cumulative sum signals (default 5). */
  decisionInterval?: number;
  /** The shift to detect, in standard errors (default 1); the reference value is half of it. */
  seShift?: number;
  /** Further groups whose sums continue those of `data`. */
  newdata?: QccData;
  /** The sizes of the groups of `newdata`. */
  newsizes?: number | readonly number[];
}

/**
 * Result of {@link cusum}.
 * @category Descriptive statistics
 */
export interface CusumResult {
  /** The group means (or values) of data. */
  statistics: number[];
  /** The group means (or values) of newdata. */
  newstatistics: number[];
  /** The sizes of data and newdata. */
  sizes: number[];
  center: number;
  stdDev: number;
  /** The upper cumulative sums C+. */
  pos: number[];
  /** The lower cumulative sums as non-positive values (-C-, as qcc). */
  neg: number[];
  headStart: number;
  decisionInterval: number;
  seShift: number;
  /** Indices (1-based) where -neg or pos exceeds the decision interval. */
  violations: { lower: number[]; upper: number[] };
  warnings: string[];
}

/** The xbar (grouped) or xbar.one chart behind cusum and ewma */
function baseChart(data: QccData, o: { sizes?: number | readonly number[]; center?: number; stdDev?: number | QccStdDevMethod;
  newdata?: QccData; newsizes?: number | readonly number[] }) {
  const type: QccType = isMatrix(data) ? "xbar" : "xbar.one";
  const q = fitQcc(data, {
    type, ...(o.center === undefined ? {} : { center: o.center }), ...(o.stdDev === undefined ? {} : { stdDev: o.stdDev }),
    ...(o.newdata === undefined ? {} : { newdata: o.newdata }),
  });
  const sizes = type === "xbar" ? q.sizes : sizesOf(o.sizes, q.statistics.length, "sizes") ?? q.sizes;
  const newsizes = type === "xbar" ? q.newsizes : sizesOf(o.newsizes ?? (typeof o.sizes === "number" ? o.sizes : undefined),
    q.newstatistics.length, "newsizes") ?? q.newsizes;
  return { stats: [...q.statistics, ...q.newstatistics], sizes: [...sizes, ...newsizes], count: q.statistics.length,
    center: q.center as number, sd: q.stdDev as number };
}

/**
 * A cusum chart (qcc's `cusum`): the tabular cumulative sums of the standardized group means (or individual values)
 * above and below the target, with the reference value `seShift / 2` and the decision interval.
 *
 * @param data one row per group, or individual values
 * @category Descriptive statistics
 */
export function cusum(data: QccData, options: CusumOptions = {}): CusumResult {
  const h = options.decisionInterval ?? 5, shift = options.seShift ?? 1, h0 = options.headStart ?? 0;
  if (!(h0 >= 0 && h0 < h)) throw new RangeError("head.start must be non-negative and less than decision.interval");
  const sink = new Warnings();
  const b = withWarnings(sink, () => baseChart(data, options));
  const k = shift / 2;
  const pos: number[] = [], neg: number[] = [];
  let a = h0, c = h0;
  b.stats.forEach((v, i) => {
    const z = (v - b.center) / (b.sd / Math.sqrt(b.sizes[i]!));
    a = Math.max(0, a + z - k);
    c = Math.max(0, c - z - k);
    pos.push(a);
    neg.push(-c);
  });
  const lower: number[] = [], upper: number[] = [];
  pos.forEach((v, i) => { if (v > h) upper.push(i + 1); });
  neg.forEach((v, i) => { if (-v > h) lower.push(i + 1); });
  return reported("cusum", {
    statistics: b.stats.slice(0, b.count), newstatistics: b.stats.slice(b.count), sizes: b.sizes, center: b.center,
    stdDev: b.sd, pos, neg, headStart: h0,
    decisionInterval: h, seShift: shift, violations: { lower, upper }, warnings: sink.list,
  });
}

/**
 * Options for {@link ewma}.
 * @category Descriptive statistics
 */
export interface EwmaOptions {
  /** The group sizes (individual values: 1). */
  sizes?: number | readonly number[];
  /** The target and starting value (default: the center of the xbar or xbar.one chart of the data). */
  center?: number;
  /** The process standard deviation or the method that estimates it (as {@link qcc}). */
  stdDev?: number | QccStdDevMethod;
  /** The smoothing parameter in [0, 1] (default 0.2). */
  lambda?: number;
  /** The number of standard deviations of the limits (default 3). */
  nsigmas?: number;
  /** Further groups smoothed on from `data`. */
  newdata?: QccData;
  /** The sizes of the groups of `newdata`. */
  newsizes?: number | readonly number[];
}

/**
 * Result of {@link ewma}.
 * @category Descriptive statistics
 */
export interface EwmaResult {
  /** The group means (or values) of data. */
  statistics: number[];
  /** The group means (or values) of newdata. */
  newstatistics: number[];
  sizes: number[];
  center: number;
  stdDev: number;
  /** The smoothed values. */
  y: number[];
  /** The standard deviation of each smoothed value (qcc's closed form with each point's own size). */
  sigma: number[];
  lambda: number;
  nsigmas: number;
  /** The limits of each point. */
  limits: { lcl: number[]; ucl: number[] };
  /** Indices (1-based) of the points outside their limits. */
  violations: number[];
  warnings: string[];
}

/**
 * An EWMA chart (qcc's `ewma`): the exponentially weighted moving average of the group means (or individual values),
 * started at the center, with limits `center +- nsigmas sigma_i`, `sigma_i = sd / sqrt(n_i) sqrt(lambda / (2 - lambda)
 * (1 - (1 - lambda)^(2 i)))` (qcc's form, with each point's own size also when the sizes differ).
 *
 * @param data one row per group, or individual values
 * @category Descriptive statistics
 */
export function ewma(data: QccData, options: EwmaOptions = {}): EwmaResult {
  const lambda = options.lambda ?? 0.2, nsigmas = options.nsigmas ?? 3;
  if (!(lambda >= 0 && lambda <= 1)) throw new RangeError("lambda must be in [0, 1]");
  const sink = new Warnings();
  const b = withWarnings(sink, () => baseChart(data, options));
  const y: number[] = [], sigma: number[] = [], lcl: number[] = [], ucl: number[] = [], violations: number[] = [];
  let a = b.center;
  b.stats.forEach((v, i) => {
    a = lambda * v + (1 - lambda) * a;
    y.push(a);
    const s = b.sd / Math.sqrt(b.sizes[i]!) * Math.sqrt(lambda / (2 - lambda) * (1 - (1 - lambda) ** (2 * (i + 1))));
    sigma.push(s);
    lcl.push(b.center - nsigmas * s);
    ucl.push(b.center + nsigmas * s);
    if (a < lcl[i]! || a > ucl[i]!) violations.push(i + 1);
  });
  return reported("ewma", {
    statistics: b.stats.slice(0, b.count), newstatistics: b.stats.slice(b.count), sizes: b.sizes, center: b.center,
    stdDev: b.sd, y, sigma, lambda, nsigmas,
    limits: { lcl, ucl }, violations, warnings: sink.list,
  });
}

/**
 * Options for {@link ewmaSmooth}.
 * @category Descriptive statistics
 */
export interface EwmaSmoothOptions {
  /** The smoothing parameter (default 0.2). */
  lambda?: number;
  /** The starting value (default: the first y in the order of x). */
  start?: number;
}

/**
 * Result of {@link ewmaSmooth}.
 * @category Descriptive statistics
 */
export interface EwmaSmoothResult {
  /** x sorted. */
  x: number[];
  /** The smoothed y in the order of x. */
  y: number[];
  lambda: number;
  start: number;
}

/**
 * EWMA smoothing (qcc's `ewmaSmooth`): orders the points by x and smooths y with `z_t = lambda y_t + (1 - lambda)
 * z_{t-1}`, `z_0 = start`.
 * @category Descriptive statistics
 */
export function ewmaSmooth(x: readonly number[], y: readonly number[], options: EwmaSmoothOptions = {}): EwmaSmoothResult {
  if (x.length !== y.length) throw new RangeError("x and y must have the same length");
  const lambda = options.lambda ?? 0.2;
  const order = x.map((_, i) => i).sort((i, j) => x[i]! - x[j]! || i - j);
  const ys = order.map((i) => y[i]!);
  const start = options.start ?? ys[0]!;
  let a = start;
  const z = ys.map((v) => (a = lambda * v + (1 - lambda) * a));
  return { x: order.map((i) => x[i]!), y: z, lambda, start };
}
