// Non-metric multidimensional scaling using Kruskal Stress-1 and primary-tie isotonic regression.
import { cmdscale } from "./cmdscale.js";
import type { DistResult } from "./dist.js";

export interface IsoMDSOptions {
  k?: number;
  y?: readonly (readonly number[])[];
  maxit?: number;
  tol?: number;
  p?: number;
}
export interface IsoMDSTrace {
  iteration: number;
  stress: number;
  converged: boolean;
}
export interface IsoMDSMatrix { rows: string[] | null; cols: string[] | null; values: number[][]; }
export interface IsoMDSResult {
  points: IsoMDSMatrix;
  stress: number;
  trace: IsoMDSTrace[];
}

interface Pair { i: number; j: number; delta: number; group: number; }
interface Evaluation { stress: number; distances: number[]; disparities: number[]; }

function readD(input: DistResult | readonly (readonly number[])[]): { d: number[][]; missing: boolean } {
  if (Array.isArray(input)) {
    const n = input.length;
    if (n < 2 || input.some((r) => r.length !== n)) throw new RangeError("dissimilarity matrix must be square");
    const d = input.map((r) => Array.from(r, Number));
    return { d, missing: d.some((r) => r.some((v) => !Number.isFinite(v))) };
  }
  if (typeof input !== "object" || input === null || !Array.isArray((input as DistResult).values)) {
    throw new TypeError("d must be a dist object or a square matrix");
  }
  const value = input as DistResult;
  const n = value.size;
  if (!Number.isInteger(n) || n < 2 || value.values.length !== n * (n - 1) / 2) throw new RangeError("invalid dissimilarity object");
  const d = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  let at = 0;
  for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) {
    d[i]![j] = value.values[at]!;
    d[j]![i] = value.values[at]!;
    at++;
  }
  return { d, missing: d.some((r) => r.some((v) => !Number.isFinite(v))) };
}

function distance(a: readonly number[], b: readonly number[], p: number): number {
  let sum = 0;
  for (let q = 0; q < a.length; q++) sum += Math.abs(a[q]! - b[q]!) ** p;
  return sum ** (1 / p);
}
function center(y: number[][]): void {
  const p = y[0]!.length;
  for (let q = 0; q < p; q++) {
    let m = 0;
    for (const row of y) m += row[q]!;
    m /= y.length;
    for (const row of y) row[q] = row[q]! - m;
  }
}
function pairsFor(d: number[][], missing: boolean): { pairs: Pair[]; groups: number; scale: number } {
  const n = d.length;
  const pairs: Pair[] = [];
  let scale = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const delta = d[i]![j]!;
    if (!Number.isFinite(delta)) continue;
    if (delta <= 0) throw new RangeError("zero or negative distance between objects");
    scale = Math.max(scale, delta);
    pairs.push({ i, j, delta, group: 0 });
  }
  void missing;
  pairs.sort((a, b) => a.delta - b.delta || a.i - b.i || a.j - b.j);
  let groups = 0, last = NaN;
  for (const pair of pairs) {
    if (groups === 0 || pair.delta !== last) { groups++; last = pair.delta; }
    pair.group = groups - 1;
  }
  return { pairs, groups, scale: scale || 1 };
}

/** Weighted pool-adjacent-violators regression; equal input dissimilarities are one primary-tie block. */
function disparitiesFor(pairs: readonly Pair[], groups: number, distances: readonly number[]): number[] {
  const sum = new Array<number>(groups).fill(0);
  const weight = new Array<number>(groups).fill(0);
  for (let i = 0; i < pairs.length; i++) {
    const g = pairs[i]!.group;
    sum[g] = sum[g]! + distances[i]!;
    weight[g] = weight[g]! + 1;
  }
  const means = sum.map((v, i) => v / weight[i]!);
  const starts: number[] = [], ends: number[] = [], values: number[] = [], weights: number[] = [];
  for (let g = 0; g < groups; g++) {
    starts.push(g); ends.push(g); values.push(means[g]!); weights.push(weight[g]!);
    while (values.length > 1 && values[values.length - 2]! > values[values.length - 1]!) {
      const last = values.length - 1;
      const w = weights[last - 1]! + weights[last]!;
      values[last - 1] = (values[last - 1]! * weights[last - 1]! + values[last]! * weights[last]!) / w;
      weights[last - 1] = w;
      ends[last - 1] = ends[last]!;
      starts.pop(); ends.pop(); values.pop(); weights.pop();
    }
  }
  const fitted = new Array<number>(groups);
  for (let b = 0; b < values.length; b++) for (let g = starts[b]!; g <= ends[b]!; g++) fitted[g] = values[b]!;
  let normD = 0, normF = 0;
  for (const v of distances) normD += v * v;
  for (let g = 0; g < groups; g++) normF += weight[g]! * fitted[g]! * fitted[g]!;
  const factor = normF > 0 ? Math.sqrt(normD / normF) : 1;
  return pairs.map((pair) => fitted[pair.group]! * factor);
}

function evaluate(y: number[][], pairs: readonly Pair[], groups: number[], p: number): Evaluation {
  const distances = pairs.map((pair) => distance(y[pair.i]!, y[pair.j]!, p));
  const disparities = disparitiesFor(pairs, groups.length, distances);
  let numerator = 0, denominator = 0;
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i]!, diff = d - disparities[i]!;
    numerator += diff * diff;
    denominator += d * d;
  }
  return { stress: denominator === 0 ? 0 : 100 * Math.sqrt(numerator / denominator), distances, disparities };
}
function gradient(y: number[][], pairs: readonly Pair[], current: Evaluation, p: number): number[][] {
  const n = y.length, dim = y[0]!.length;
  const out = Array.from({ length: n }, () => new Array<number>(dim).fill(0));
  for (let at = 0; at < pairs.length; at++) {
    const pair = pairs[at]!, d = current.distances[at]!;
    if (d === 0) continue;
    const factor = (d - current.disparities[at]!) / (d ** (p - 1));
    for (let q = 0; q < dim; q++) {
      const diff = y[pair.i]![q]! - y[pair.j]![q]!;
      const v = factor * Math.sign(diff) * (Math.abs(diff) ** (p - 1));
      out[pair.i]![q] = out[pair.i]![q]! + v;
      out[pair.j]![q] = out[pair.j]![q]! - v;
    }
  }
  return out;
}
function orient(y: number[][]): void {
  const p = y[0]!.length;
  for (let q = 0; q < p; q++) {
    let at = 0, largest = -1;
    for (let i = 0; i < y.length; i++) if (Math.abs(y[i]![q]!) > largest) { largest = Math.abs(y[i]![q]!); at = i; }
    if (y[at]![q]! < 0) for (const row of y) row[q] = -row[q]!;
  }
}

/**
 * Non-metric multidimensional scaling by minimizing Kruskal Stress-1.
 * Equivalent to MASS::isoMDS().
 * @category Multivariate analysis
 */
export function isoMDS(
  input: DistResult | readonly (readonly number[])[],
  options: IsoMDSOptions = {},
): IsoMDSResult {
  const parsed = readD(input);
  const n = parsed.d.length;
  const k = options.k ?? 2;
  if (!Number.isInteger(k) || k < 1 || k >= n) throw new RangeError(`'k' must be in {1, 2, ..  ${n - 1}}`);
  const p = options.p ?? 2;
  if (!Number.isFinite(p) || p <= 0) throw new RangeError("'p' must be positive");
  const maxit = options.maxit ?? 50;
  const tol = options.tol ?? 1e-3;
  if (!Number.isInteger(maxit) || maxit < 0) throw new RangeError("'maxit' must be non-negative");
  if (!Number.isFinite(tol) || tol <= 0) throw new RangeError("'tol' must be positive");
  if (parsed.missing && options.y === undefined) throw new RangeError("an initial configuration must be supplied with NA/Infs in 'd'");
  if (Array.isArray(input)) throw new TypeError("d must be a dist object");
  const built = pairsFor(parsed.d, parsed.missing);
  if (options.y !== undefined && (options.y.length !== n || options.y.some((r) => r.length !== k))) {
    throw new RangeError("invalid initial configuration");
  }
  const condensed: number[] = [];
  for (let j = 0; j < n - 1; j++) for (let i = j + 1; i < n; i++) condensed.push(parsed.d[i]![j]!);
  let y = options.y === undefined
    ? cmdscale({ values: condensed, size: n, labels: null, method: null, diag: false, upper: false, warnings: [] }, { k }).points.values
    : options.y.map((r) => Array.from(r));
  if (y.length !== n || y.some((r) => r.length !== k)) throw new RangeError("invalid initial configuration");
  if (y.some((r) => r.some((v) => !Number.isFinite(v)))) throw new RangeError("initial configuration must be finite");
  const scale = built.scale;
  center(y);
  let yScale = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) yScale = Math.max(yScale, distance(y[i]!, y[j]!, p));
  if (yScale > 0) y = y.map((r) => r.map((v) => v / yScale));
  let current = evaluate(y, built.pairs, Array.from({ length: built.groups }, (_, i) => i), p);
  const trace: IsoMDSTrace[] = [{ iteration: 0, stress: current.stress, converged: maxit === 0 }];
  let converged = maxit === 0;
  let lastIter = 0;
  for (let iteration = 1; iteration <= maxit && !converged; iteration++) {
    lastIter = iteration;
    const grad = gradient(y, built.pairs, current, p);
    let norm = 0;
    for (const row of grad) for (const v of row) norm += v * v;
    if (norm <= Number.EPSILON * Number.EPSILON) { converged = true; break; }
    let step = 1;
    let candidate = y;
    let next = current;
    for (let trial = 0; trial < 30; trial++) {
      candidate = y.map((row, i) => row.map((v, q) => v - step * grad[i]![q]!));
      center(candidate);
      next = evaluate(candidate, built.pairs, Array.from({ length: built.groups }, (_, i) => i), p);
      if (next.stress < current.stress) break;
      step *= 0.5;
    }
    if (!(next.stress < current.stress)) { converged = true; break; }
    const improvement = current.stress - next.stress;
    y = candidate; current = next;
    if (iteration % 5 === 0) trace.push({ iteration, stress: current.stress, converged: false });
    if (improvement <= tol * Math.max(1, current.stress)) converged = true;
  }
  if (maxit > 0) trace.push({ iteration: lastIter, stress: current.stress, converged });
  orient(y);
  return { points: { rows: (input as DistResult).labels === undefined ? null : (input as DistResult).labels, cols: null,
    values: y.map((r) => r.map((v) => v * scale)) }, stress: current.stress, trace };
}
