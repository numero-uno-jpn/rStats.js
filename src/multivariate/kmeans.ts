// K-means clustering: batch Lloyd/Forgy, online MacQueen, and point-transfer Hartigan-Wong.
import { sampleInt } from "../random/sample.js";

export interface KmeansOptions {
  algorithm?: "Hartigan-Wong" | "Lloyd" | "Forgy" | "MacQueen" | string;
  iterMax?: number;
  nstart?: number;
}

export interface KmeansMatrixInput { rows: string[] | null; cols: string[] | null; values: readonly (readonly number[])[]; }

export interface KmeansTable {
  rows: string[];
  cols: string[] | null;
  values: number[][];
}

export interface KmeansFit {
  cluster: number[];
  names?: string[];
  centers: KmeansTable;
  totss: number;
  withinss: number[];
  totWithinss: number;
  betweenss: number;
  size: number[];
  iter: number;
  ifault: number | null;
  warnings: string[];
}

interface InputData { rows: number[][]; rowNames: string[] | null; colNames: string[] | null; }

function readData(x: readonly unknown[] | readonly (readonly unknown[])[] | Record<string, ArrayLike<unknown>>): InputData {
  if (Array.isArray(x)) {
    if (x.length === 0) throw new RangeError("x must be a non-empty numeric matrix");
    if (!Array.isArray(x[0])) return { rows: x.map((v) => [Number(v)]), rowNames: null, colNames: null };
    const raw = x as readonly (readonly unknown[])[];
    const p = raw[0]!.length;
    if (p === 0 || raw.some((r) => r.length !== p)) throw new RangeError("x must be a non-empty matrix with equal row lengths");
    return { rows: raw.map((r) => r.map(Number)), rowNames: null, colNames: null };
  }
  if (typeof x === "object" && x !== null) {
    const table = x as { values?: readonly (readonly unknown[])[]; rows?: string[] | null; cols?: string[] | null };
    if (Array.isArray(table.values)) {
      const raw = table.values;
      const p = raw[0]?.length ?? 0;
      if (p === 0 || raw.some((r) => r.length !== p)) throw new RangeError("x must be a non-empty matrix with equal row lengths");
      return { rows: raw.map((r) => r.map(Number)), rowNames: table.rows ?? null, colNames: table.cols ?? null };
    }
    const cols = Object.entries(x as Record<string, ArrayLike<unknown>>);
    if (cols.length === 0) throw new RangeError("x must have at least one column");
    const n = cols[0]![1].length;
    if (cols.some(([, v]) => v.length !== n)) throw new RangeError("columns must have equal lengths");
    return { rows: Array.from({ length: n }, (_, i) => cols.map(([, v]) => Number(v[i]))), rowNames: null,
      colNames: cols.map(([name]) => name) };
  }
  throw new TypeError("x must be a numeric vector, matrix, or data frame");
}

function sameRow(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}
function squared(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let j = 0; j < a.length; j++) { const d = a[j]! - b[j]!; s += d * d; }
  return s;
}
function nearest(row: readonly number[], centers: readonly (readonly number[])[]): number {
  let best = 0, value = squared(row, centers[0]!);
  for (let j = 1; j < centers.length; j++) {
    const d = squared(row, centers[j]!);
    if (d < value) { best = j; value = d; }
  }
  return best;
}
function means(rows: readonly (readonly number[])[], cluster: readonly number[], k: number, p: number): { centers: number[][]; size: number[] } {
  const centers = Array.from({ length: k }, () => new Array<number>(p).fill(0));
  const size = new Array<number>(k).fill(0);
  for (let i = 0; i < rows.length; i++) {
    const g = cluster[i]!;
    size[g] = size[g]! + 1;
    for (let j = 0; j < p; j++) centers[g]![j] = centers[g]![j]! + rows[i]![j]!;
  }
  for (let g = 0; g < k; g++) if (size[g]! > 0) {
    for (let j = 0; j < p; j++) centers[g]![j] = centers[g]![j]! / size[g]!;
  }
  return { centers, size };
}
function totalSS(rows: readonly (readonly number[])[], p: number): number {
  const center = new Array<number>(p).fill(0);
  for (const row of rows) for (let j = 0; j < p; j++) center[j] = center[j]! + row[j]!;
  for (let j = 0; j < p; j++) center[j] = center[j]! / rows.length;
  let sum = 0;
  for (const row of rows) sum += squared(row, center);
  return sum;
}
function fitStats(rows: number[][], cluster: number[], k: number, colNames: string[] | null,
  rowNames: string[] | null, iter: number, ifault: number | null, warnings: string[]): KmeansFit {
  const p = rows[0]!.length;
  const { centers, size } = means(rows, cluster, k, p);
  const withinss = new Array<number>(k).fill(0);
  for (let i = 0; i < rows.length; i++) withinss[cluster[i]!]! += squared(rows[i]!, centers[cluster[i]!]!);
  const totss = totalSS(rows, p);
  const totWithinss = withinss.reduce((a, b) => a + b, 0);
  const out: KmeansFit = { cluster: cluster.map((v) => v + 1), centers: {
    rows: Array.from({ length: k }, (_, i) => String(i + 1)), cols: colNames, values: centers,
  }, totss, withinss, totWithinss, betweenss: totss - totWithinss, size, iter, ifault, warnings };
  if (rowNames !== null) out.names = [...rowNames];
  return out;
}
function lloyd(rows: number[][], initial: number[][], iterMax: number): { cluster: number[]; iter: number; converged: boolean } {
  const k = initial.length;
  let centers = initial.map((r) => [...r]);
  let cluster = rows.map((row) => nearest(row, centers));
  let converged = false, iter = 0;
  for (let pass = 0; pass < iterMax; pass++) {
    const next = rows.map((row) => nearest(row, centers));
    const changed = next.some((v, i) => v !== cluster[i]);
    const stats = means(rows, next, k, rows[0]!.length);
    for (let g = 0; g < k; g++) if (stats.size[g]! > 0) centers[g] = stats.centers[g]!;
    cluster = next;
    iter = pass + 1;
    if (!changed && pass > 0) { converged = true; break; }
  }
  return { cluster, iter: iter + (converged ? 0 : 1), converged };
}
function macqueen(rows: number[][], initial: number[][], iterMax: number): { cluster: number[]; iter: number; converged: boolean } {
  const k = initial.length, p = rows[0]!.length;
  let centers = initial.map((r) => [...r]);
  let cluster = rows.map((row) => nearest(row, centers));
  let converged = false, iter = 0;
  for (let pass = 0; pass < iterMax; pass++) {
    const next = new Array<number>(rows.length).fill(-1);
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < rows.length; i++) {
      const g = nearest(rows[i]!, centers);
      next[i] = g;
      const count = counts[g]!;
      for (let j = 0; j < p; j++) centers[g]![j] = centers[g]![j]! + (rows[i]![j]! - centers[g]![j]!) / (count + 1);
      counts[g] = count + 1;
    }
    const changed = next.some((v, i) => v !== cluster[i]);
    cluster = next; iter = pass + 1;
    if (!changed) { converged = true; break; }
  }
  return { cluster, iter: iter + (converged ? 0 : 1), converged };
}
function hartiganWong(rows: number[][], initial: number[][], iterMax: number): { cluster: number[]; iter: number; converged: boolean } {
  const k = initial.length, p = rows[0]!.length;
  let cluster = rows.map((row) => nearest(row, initial));
  let { centers, size } = means(rows, cluster, k, p);
  if (size.some((v) => v === 0)) throw new RangeError("empty cluster: try a better set of initial centers");
  let converged = false, iter = 0;
  for (let pass = 0; pass < iterMax; pass++) {
    let moved = false;
    for (let i = 0; i < rows.length; i++) {
      const from = cluster[i]!;
      if (size[from]! <= 1) continue;
      const row = rows[i]!;
      const removeCost = size[from]! / (size[from]! - 1) * squared(row, centers[from]!);
      let to = from, bestGain = 0;
      for (let g = 0; g < k; g++) if (g !== from) {
        const addCost = size[g]! / (size[g]! + 1) * squared(row, centers[g]!);
        const gain = removeCost - addCost;
        if (gain > bestGain) { bestGain = gain; to = g; }
      }
      if (to !== from) {
        const oldN = size[from]!, newN = size[to]!;
        for (let j = 0; j < p; j++) {
          centers[from]![j] = (oldN * centers[from]![j]! - row[j]!) / (oldN - 1);
          centers[to]![j] = (newN * centers[to]![j]! + row[j]!) / (newN + 1);
        }
        size[from] = oldN - 1; size[to] = newN + 1; cluster[i] = to; moved = true;
      }
    }
    iter = pass + 1;
    if (!moved) { converged = true; break; }
  }
  return { cluster, iter: iter + (converged ? 0 : 1), converged };
}

/**
 * Partition observations into k clusters by minimizing within-cluster sum of squares.
 * Equivalent to R's stats::kmeans().
 * @category Multivariate analysis
 */
export function kmeans(
  x: readonly unknown[] | readonly (readonly unknown[])[] | Record<string, ArrayLike<unknown>> | KmeansMatrixInput,
  centersInput: number | readonly number[] | readonly (readonly number[])[],
  options: KmeansOptions = {},
): KmeansFit {
  const data = readData(x);
  const rows = data.rows, n = rows.length, p = rows[0]?.length ?? 0;
  if (n < 1 || p < 1 || rows.some((r) => r.length !== p)) throw new RangeError("x must be a non-empty matrix");
  if (rows.some((r) => r.some((v) => !Number.isFinite(v)))) throw new RangeError("NA/NaN/Inf in foreign function call (arg 1)");
  const algorithms = ["Hartigan-Wong", "Lloyd", "Forgy", "MacQueen"];
  const requested = options.algorithm ?? "Hartigan-Wong";
  const matches = algorithms.filter((v) => v.startsWith(requested));
  if (matches.length !== 1) throw new RangeError("invalid algorithm");
  const algorithm = matches[0]!;
  const iterMax = options.iterMax ?? 10;
  if (!Number.isFinite(iterMax) || iterMax < 1) throw new RangeError("'iter.max' must be positive");
  const maxIterations = Math.trunc(iterMax);
  const nstart = Math.max(1, Math.trunc(options.nstart ?? 1));
  let initialSets: number[][][] = [];
  if (typeof centersInput === "number") {
    const k = Math.trunc(centersInput);
    if (k < 1 || k > n) throw new RangeError("centers must be between 1 and nrow(x)");
    const distinct = new Set(rows.map((r) => JSON.stringify(r))).size;
    if (k > distinct) throw new RangeError("more cluster centers than distinct data points.");
    for (let start = 0; start < nstart; start++) {
      let chosen: number[][] = [];
      for (let attempt = 0; attempt < 10000; attempt++) {
        const indices = sampleInt(n, { size: k });
        chosen = indices.map((i) => [...rows[i]!]);
        if (new Set(chosen.map((r) => JSON.stringify(r))).size === k) break;
      }
      if (chosen.length !== k || new Set(chosen.map((r) => JSON.stringify(r))).size !== k) {
        throw new RangeError("unable to find distinct initial centers");
      }
      initialSets.push(chosen);
    }
  } else {
    const initial = centersInput.length > 0 && typeof centersInput[0] === "number"
      ? (centersInput as readonly number[]).map((v) => [Number(v)])
      : (centersInput as readonly (readonly number[])[]).map((r) => Array.from(r, Number));
    if (initial.length < 1 || initial.some((r) => r.length !== p)) throw new RangeError("must have same number of columns in 'x' and 'centers'");
    if (initial.some((r) => r.some((v) => !Number.isFinite(v)))) throw new RangeError("initial centers must be finite");
    for (let i = 0; i < initial.length; i++) for (let j = 0; j < i; j++) {
      if (sameRow(initial[i]!, initial[j]!)) throw new RangeError("initial centers are not distinct");
    }
    initialSets = [initial];
  }
  const k = initialSets[0]!.length;
  if (algorithm === "Hartigan-Wong" && k === n) throw new RangeError("number of cluster centres must lie between 1 and nrow(x)");
  let best: KmeansFit | null = null;
  let bestW = Infinity;
  for (const initial of initialSets) {
    const result = algorithm === "Hartigan-Wong" ? hartiganWong(rows, initial, maxIterations)
      : algorithm === "MacQueen" ? macqueen(rows, initial, maxIterations) : lloyd(rows, initial, maxIterations);
    const warnings: string[] = [];
    const stats = means(rows, result.cluster, k, p);
    if (stats.size.some((v) => v === 0)) {
      if (algorithm === "Hartigan-Wong") throw new RangeError("empty cluster: try a better set of initial centers");
      warnings.push("empty cluster: try a better set of initial centers", "empty cluster: try a better set of initial centers");
    }
    if (!result.converged) warnings.push(`did not converge in ${maxIterations} ${maxIterations === 1 ? "iteration" : "iterations"}`);
    const fit = fitStats(rows, result.cluster, k, data.colNames, data.rowNames, result.iter,
      algorithm === "Hartigan-Wong" ? (result.converged ? 0 : 2) : null, warnings);
    if (fit.totWithinss < bestW) { best = fit; bestW = fit.totWithinss; }
  }
  return best!;
}
