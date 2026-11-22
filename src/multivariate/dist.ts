// Pairwise dissimilarities and conversion to condensed form.

import { checkOptions } from "../internal/checkOptions.js";

const DIST_KEYS = ["method", "p", "diag", "upper", "labels"] as const;
const AS_DIST_KEYS = ["labels", "diag", "upper"] as const;
const MIN_NORMAL = 2 ** -1022;

/** Distance metric used by {@link dist}.
 * @category Multivariate analysis
 */
export type DistMethod = "euclidean" | "maximum" | "manhattan" | "canberra" | "binary" | "minkowski";

/** A condensed dissimilarity object, in lower-triangle column order.
 * @category Multivariate analysis
 */
export interface DistObject {
  values: number[];
  size: number;
  labels: string[] | null;
  method: DistMethod | null;
  diag: boolean;
  upper: boolean;
  warnings: string[];
}

/** Options for pairwise dissimilarities.
 * @category Multivariate analysis
 */
export interface DistOptions {
  method?: DistMethod | string;
  p?: number;
  diag?: boolean;
  upper?: boolean;
  labels?: readonly string[];
}

/** Options for converting a square matrix to condensed dissimilarities.
 * @category Multivariate analysis
 */
export interface AsDistOptions {
  labels?: readonly string[];
  diag?: boolean;
  upper?: boolean;
}

function methodName(method: string): DistMethod {
  const methods: DistMethod[] = ["euclidean", "maximum", "manhattan", "canberra", "binary", "minkowski"];
  const matches = methods.filter((name) => name.startsWith(method));
  if (matches.length !== 1) throw new RangeError("invalid distance method");
  return matches[0]!;
}

function inputMatrix(input: unknown): { rows: number[][]; labels: string[] | null; warning: boolean } {
  if (Array.isArray(input)) {
    if (input.length === 0) throw new RangeError("x must be a non-empty matrix or vector");
    if (!Array.isArray(input[0])) {
      const rows = input.map((v) => [coerce(v)]);
      return { rows, labels: null, warning: input.some((v) => typeof v === "string") };
    }
    const raw = input as unknown[][];
    const width = raw[0]!.length;
    if (raw.some((r) => r.length !== width)) throw new RangeError("inconsistent number of columns");
    const warning = raw.some((r) => r.some((v) => typeof v === "string"));
    return { rows: raw.map((r) => r.map(coerce)), labels: null, warning };
  }
  if (typeof input === "object" && input !== null) {
    const columns = Object.entries(input as Record<string, ArrayLike<unknown>>);
    if (columns.length === 0) throw new RangeError("x must have at least one column");
    const n = columns[0]![1].length;
    if (columns.some(([, v]) => v.length !== n)) throw new RangeError("columns must have equal lengths");
    const rows = Array.from({ length: n }, (_, i) => columns.map(([, v]) => coerce(v[i])));
    return { rows, labels: null, warning: columns.some(([, v]) => Array.from(v).some((x) => typeof x === "string")) };
  }
  throw new TypeError("x must be a numeric vector, matrix, or data frame");
}

function coerce(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim() === "" ? 0 : Number(value);
  return Number(value);
}

function scaledPowerSum(diffs: readonly number[], p: number): number {
  let scale = 0;
  for (const d of diffs) scale = Math.max(scale, Math.abs(d));
  if (scale === 0) return 0;
  let sum = 0;
  for (const d of diffs) sum += (Math.abs(d) / scale) ** p;
  return scale * sum ** (1 / p);
}

function pairDistance(a: readonly number[], b: readonly number[], method: DistMethod, p: number): number {
  const diffs: number[] = [];
  const canberra: number[] = [];
  let binaryUnion = 0;
  let binaryDifferent = 0;
  let binaryObserved = 0;
  let binaryWarning = false;
  for (let j = 0; j < a.length; j++) {
    const x = a[j]!, y = b[j]!;
    if (method === "binary") {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        if (x === Infinity || x === -Infinity || y === Infinity || y === -Infinity) binaryWarning = true;
        continue;
      }
      binaryObserved++;
      const ax = x !== 0, by = y !== 0;
      if (ax || by) binaryUnion++;
      if (ax !== by) binaryDifferent++;
      continue;
    }
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    if (!Number.isFinite(x) && !Number.isFinite(y) && x === y) continue;
    if (method === "canberra") {
      if (x === y && !Number.isFinite(x)) continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) { canberra.push(1); continue; }
      const den = Math.abs(x) + Math.abs(y);
      if (den > 0) canberra.push(Math.abs(x - y) / den);
      continue;
    }
    diffs.push(Math.abs(x - y));
  }
  if (method === "binary") return binaryObserved === 0 ? NaN : binaryUnion === 0 ? 0 : binaryDifferent / binaryUnion;
  if (method === "canberra") {
    if (canberra.length === 0) return NaN;
    return (a.length / canberra.length) * canberra.reduce((s, v) => s + v, 0);
  }
  if (diffs.length === 0) return NaN;
  if (diffs.some((d) => d === Infinity)) return Infinity;
  if (method === "maximum") {
    let max = 0;
    for (const d of diffs) max = Math.max(max, d);
    return max;
  }
  if (method === "manhattan") {
    let sum = 0;
    for (const d of diffs) sum += d;
    const result = (a.length / diffs.length) * sum;
    if (Number.isFinite(result) || !diffs.some((d) => Number.isFinite(d))) return result;
    let scale = 0;
    for (const d of diffs) scale = Math.max(scale, d);
    if (!Number.isFinite(scale)) return Infinity;
    return scale * ((a.length / diffs.length) * diffs.reduce((s, d) => s + d / scale, 0));
  }
  let sum = 0;
  for (const d of diffs) sum += method === "minkowski" ? d ** p : d * d;
  const power = method === "minkowski" ? p : 2;
  const ordinary = ((a.length / diffs.length) * sum) ** (1 / power);
  const nonzero = diffs.some((d) => d !== 0);
  if (Number.isFinite(ordinary) && !(ordinary === 0 && nonzero) && !(sum > 0 && sum < MIN_NORMAL)) return ordinary;
  const stable = scaledPowerSum(diffs, power) * (a.length / diffs.length) ** (1 / power);
  return stable;
}

/**
 * Equivalent to R's `stats::dist()`. Compute pairwise dissimilarities in lower-triangle column order.
 *
 * @param x Numeric vector, matrix (rows are observations), or data-frame-like object of columns.
 * @param options Distance method and display metadata.
 * @category Multivariate analysis
 */
export function dist(
  x: readonly unknown[] | readonly (readonly unknown[])[] | Record<string, ArrayLike<unknown>>,
  options: DistOptions = {},
): DistObject {
  checkOptions(options, DIST_KEYS, "dist"); // generated: option-keys.mjs
  const method = methodName(options.method ?? "euclidean");
  const p = options.p ?? 2;
  if (method === "minkowski" && !(Number.isFinite(p) && p > 0)) throw new RangeError("distance(): invalid p");
  const input = inputMatrix(x);
  const n = input.rows.length;
  if (options.labels !== undefined && options.labels.length !== n) throw new RangeError("labels must have one entry per row");
  const labels = options.labels === undefined ? input.labels : [...options.labels];
  const values: number[] = [];
  const warnings: string[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = j + 1; i < n; i++) {
      const a = input.rows[i]!, b = input.rows[j]!;
      if (method === "binary" && a.some((v) => !Number.isFinite(v) && !Number.isNaN(v)) ||
          method === "binary" && b.some((v) => !Number.isFinite(v) && !Number.isNaN(v))) {
        warnings.push("treating non-finite values as NA");
      }
      values.push(pairDistance(a, b, method, p));
    }
  }
  if (input.warning) warnings.unshift("NAs introduced by coercion");
  return { values, size: n, labels, method, diag: options.diag ?? false, upper: options.upper ?? false, warnings };
}

/**
 * Equivalent to R's `stats::as.dist()`. Convert a square matrix using only its lower triangle.
 * An existing DistObject is returned unchanged.
 * @category Multivariate analysis
 */
export function asDist(
  x: DistObject | readonly (readonly number[])[],
  options: AsDistOptions = {},
): DistObject {
  checkOptions(options, AS_DIST_KEYS, "asDist"); // generated: option-keys.mjs
  if (isDistObject(x)) return x;
  const n = x.length;
  if (n === 0 || x.some((r) => r.length !== n)) throw new RangeError("matrix must be square");
  if (options.labels !== undefined && options.labels.length !== n) throw new RangeError("labels must have one entry per row");
  const values: number[] = [];
  for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) values.push(Number(x[i]![j]));
  return { values, size: n, labels: options.labels === undefined ? null : [...options.labels], method: null,
    diag: options.diag ?? false, upper: options.upper ?? false, warnings: [] };
}

function isDistObject(x: unknown): x is DistObject {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const v = x as Partial<DistObject>;
  return Array.isArray(v.values) && typeof v.size === "number" && "method" in v;
}
