// Hierarchical agglomerative clustering and tree cutting.
import type { DistResult } from "./dist.js";

/** @category Multivariate analysis */
export type HclustMethod = "ward.D" | "ward.D2" | "single" | "complete" | "average" | "mcquitty" | "median" | "centroid";

/** @category Multivariate analysis */
export interface HclustOptions {
  method?: HclustMethod | string;
  members?: readonly number[];
}

/** @category Multivariate analysis */
export interface HclustFit {
  merge: number[][];
  height: number[];
  order: number[];
  labels: string[] | null;
  method: HclustMethod;
  distMethod: string | null;
  warnings: string[];
}

/** @category Multivariate analysis */
export interface CutreeOptions {
  k?: number | readonly number[];
  h?: number | readonly number[];
}

/** @category Multivariate analysis */
export interface CutreeResult {
  values: number[] | number[][];
  names: string[] | null;
  rows?: string[] | null;
  columns?: string[];
}

const METHODS: HclustMethod[] = ["ward.D", "ward.D2", "single", "complete", "average", "mcquitty", "median", "centroid"];

function resolveMethod(input: string | undefined): { method: HclustMethod; warning: string[] } {
  const raw = input ?? "complete";
  if (raw === "ward") return { method: "ward.D", warning: ['The "ward" method has been renamed to "ward.D"; note new "ward.D2"'] };
  if (METHODS.includes(raw as HclustMethod)) return { method: raw as HclustMethod, warning: [] };
  const matches = METHODS.filter((m) => m.startsWith(raw));
  if (matches.length !== 1) throw new RangeError("invalid clustering method");
  return { method: matches[0]!, warning: [] };
}

function index(n: number, a: number, b: number): number { return a * n + b; }

function updateDistance(method: HclustMethod, dAB: number, dAC: number, dBC: number, a: number, b: number, c: number): number {
  const n = a + b + c;
  if (method === "single") return Math.min(dAC, dBC);
  if (method === "complete") return Math.max(dAC, dBC);
  if (method === "average") return (a * dAC + b * dBC) / (a + b);
  if (method === "mcquitty") return (dAC + dBC) / 2;
  if (method === "ward.D") return ((a + c) * dAC + (b + c) * dBC - c * dAB) / n;
  if (method === "ward.D2") {
    const scale = Math.max(Math.abs(dAB), Math.abs(dAC), Math.abs(dBC));
    if (scale === 0) return 0;
    const ab = dAB / scale, ac = dAC / scale, bc = dBC / scale;
    const v = ((a + c) * ac * ac + (b + c) * bc * bc - c * ab * ab) / n;
    return Math.sqrt(Math.max(0, v)) * scale;
  }
  if (method === "median") return (dAC + dBC) / 2 - dAB / 4;
  const ab = a + b;
  return (a * dAC + b * dBC) / ab - (a * b * dAB) / (ab * ab);
}

function encode(node: number, n: number): number { return node < n ? -(node + 1) : node - n + 1; }

/**
 * Equivalent to R's stats::hclust().
 * @category Multivariate analysis
 */
export function hclust(d: DistResult, options: HclustOptions = {}): HclustFit & { warnings: string[] } {
  if (!d || typeof d !== "object" || !Array.isArray(d.values) || !Number.isInteger(d.size)) {
    throw new TypeError("d must be a dist object; use asDist() for a square matrix");
  }
  const n = d.size;
  if (n < 2) throw new RangeError("must have n >= 2 objects to cluster");
  if (d.values.length !== n * (n - 1) / 2) throw new RangeError("invalid dissimilarity object");
  if (d.values.some((v) => !Number.isFinite(v))) throw new RangeError("dissimilarities must be finite");
  if (options.members !== undefined && (options.members.length !== n || options.members.some((v) => !Number.isFinite(v) || v <= 0))) {
    throw new RangeError("invalid length or values of members");
  }
  const resolved = resolveMethod(options.method);
  const method = resolved.method;
  const capacity = n;
  const distances = new Float64Array(capacity * capacity);
  let p = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = j + 1; i < n; i++) {
      const v = d.values[p++]!;
      distances[index(n, i, j)] = v;
      distances[index(n, j, i)] = v;
    }
  }
  const active = new Uint8Array(n); active.fill(1);
  const rank = new Int32Array(n);
  const node = new Int32Array(n);
  const sizes = new Float64Array(n);
  const minLeaf = new Int32Array(n);
  for (let i = 0; i < n; i++) { rank[i] = i; node[i] = i; sizes[i] = options.members?.[i] ?? 1; minLeaf[i] = i; }
  const merge = new Array<number[]>(n - 1);
  const height = new Array<number>(n - 1);
  const nnc = n > 200;
  let chain: number[] = [];

  for (let step = 0; step < n - 1; step++) {
    let a = -1, b = -1, best = Infinity;
    if (!nnc) {
      let bestLo = Infinity, bestHi = Infinity;
      for (let i = 0; i < n; i++) if (active[i]) {
        for (let j = i + 1; j < n; j++) if (active[j]) {
          const value = distances[index(n, i, j)]!;
          const lo = Math.min(minLeaf[i]!, minLeaf[j]!);
          const hi = Math.max(minLeaf[i]!, minLeaf[j]!);
          if (value < best || (value === best && (lo < bestLo || (lo === bestLo && hi < bestHi)))) {
            best = value; a = i; b = j; bestLo = lo; bestHi = hi;
          }
        }
      }
    } else {
      if (chain.length === 0) {
        let first = -1, firstRank = Infinity;
        for (let i = 0; i < n; i++) if (active[i] && rank[i]! < firstRank) { first = i; firstRank = rank[i]!; }
        chain.push(first);
      }
      while (true) {
        const last = chain[chain.length - 1]!;
        let nearest = -1, nearestDistance = Infinity, nearestLeaf = Infinity;
        for (let j = 0; j < n; j++) if (active[j] && j !== last) {
          const value = distances[index(n, last, j)]!;
          if (value < nearestDistance || (value === nearestDistance && minLeaf[j]! < nearestLeaf)) {
            nearest = j; nearestDistance = value; nearestLeaf = minLeaf[j]!;
          }
        }
        if (chain.length > 1 && nearest === chain[chain.length - 2]) {
          a = last; b = nearest; best = nearestDistance;
          break;
        }
        chain.push(nearest);
      }
    }
    if (a < 0 || b < 0) throw new Error("unable to find a finite pair of clusters");
    if (rank[a]! > rank[b]!) [a, b] = [b, a];
    const nodeA = node[a]!, nodeB = node[b]!;
    merge[step] = [encode(nodeA, n), encode(nodeB, n)];
    height[step] = best;
    const sizeA = sizes[a]!, sizeB = sizes[b]!;
    const newNode = n + step;
    for (let c = 0; c < n; c++) if (active[c] && c !== a && c !== b) {
      const oldA = distances[index(n, a, c)]!;
      const oldB = distances[index(n, b, c)]!;
      const value = updateDistance(method, best, oldA, oldB, sizeA, sizeB, sizes[c]!);
      distances[index(n, a, c)] = value;
      distances[index(n, c, a)] = value;
    }
    active[b] = 0;
    node[a] = newNode;
    sizes[a] = sizeA + sizeB;
    minLeaf[a] = Math.min(minLeaf[a]!, minLeaf[b]!);
    rank[a] = n + step;
    chain = [];
  }

  const order: number[] = [];
  const left = new Int32Array(n * 2 - 1);
  const right = new Int32Array(n * 2 - 1);
  for (let i = 0; i < n - 1; i++) {
    const l = merge[i]![0]!, r = merge[i]![1]!;
    left[n + i] = l < 0 ? -l - 1 : n + l - 1;
    right[n + i] = r < 0 ? -r - 1 : n + r - 1;
  }
  const stack = [2 * n - 2];
  while (stack.length) {
    const current = stack.pop()!;
    if (current < n) order.push(current + 1);
    else { stack.push(right[current]!); stack.push(left[current]!); }
  }
  return { merge, height, order, labels: d.labels === null ? null : [...d.labels], method,
    distMethod: d.method, warnings: resolved.warning };
}

/** Cut a hierarchical clustering tree by cluster count or merge height. */
/**
 * Equivalent to R's stats::cutree().
 * @category Multivariate analysis
 */
export function cutree(tree: HclustFit, options: CutreeOptions = {}): CutreeResult {
  const n = tree.order.length;
  if (options.k === undefined && options.h === undefined) throw new RangeError("either 'k' or 'h' must be specified");
  const byK = options.k !== undefined;
  const requested = byK ? options.k! : options.h!;
  const values = Array.isArray(requested) ? [...requested] : [requested as number];
  if (values.some((v) => !Number.isFinite(v))) throw new RangeError("k and h must be finite");
  if (!byK && tree.height.some((v, i) => i > 0 && v < tree.height[i - 1]!)) {
    throw new RangeError("the 'height' component of 'tree' is not sorted (increasingly)");
  }
  const columns = values.map((v) => {
    let merges = 0;
    if (byK) {
      const k = Math.trunc(v);
      if (k < 1 || k > n) throw new RangeError(`elements of 'k' must be between 1 and ${n}`);
      merges = n - k;
    } else {
      while (merges < n - 1 && tree.height[merges]! <= v) merges++;
    }
    const parent = new Int32Array(2 * n - 1);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
    const find = (x: number): number => {
      let root = x;
      while (parent[root] !== root) root = parent[root]!;
      while (parent[x] !== x) { const next = parent[x]!; parent[x] = root; x = next; }
      return root;
    };
    for (let i = 0; i < merges; i++) {
      const pair = tree.merge[i]!;
      const root = n + i;
      const l = pair[0]! < 0 ? -pair[0]! - 1 : n + pair[0]! - 1;
      const r = pair[1]! < 0 ? -pair[1]! - 1 : n + pair[1]! - 1;
      parent[find(l)] = root;
      parent[find(r)] = root;
    }
    const labels: number[] = [];
    const map = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!map.has(root)) map.set(root, map.size + 1);
      labels.push(map.get(root)!);
    }
    return labels;
  });
  const matrix = Array.isArray(requested);
  return { values: matrix ? columns[0]?.map((_, i) => columns.map((col) => col[i]!)) ?? [] : columns[0] ?? [],
    names: matrix || tree.labels === null ? null : [...tree.labels],
    ...(matrix ? { rows: tree.labels === null ? null : [...tree.labels], columns: values.map(String) } : {}) };
}

