// Matrix exponential (the expm package's expm, methods "Higham08.b", "Higham08", "Pade", "Taylor", "PadeO" and
// "TaylorO"). Written for rStats.js.
//
// Sources: the specification oracle/matfn-behaviour.md; the scaling and squaring method with Padé approximants of
// N. J. Higham, "The scaling and squaring method for the matrix exponential revisited", SIAM J. Matrix Anal. Appl.
// 26 (2005) 1179-1193 (degrees 3, 5, 7, 9 and 13, the bounds on the 1-norm and the Padé coefficients);
// the balancing is src/linalg/balance.ts (a port of LAPACK 3.12.0's SRC/dgebal.f, modified BSD).
// - "Higham08.b" (default) balances first: dgebal with job "P" (permutation), then dgebal with job "S" (scaling) on
//   the result, as two separate calls; "Higham08" does not balance
// - The Padé degree is chosen from the 1-norm of the (balanced) matrix; above 2.1, degree 13 with scaling by 2^-s
// - X = (V - U)^-1 (V + U) is solved by LU decomposition as solve (which throws if V - U is computationally
//   singular), then squared s times, and the balancing is undone
// - "Pade", "Taylor", "PadeO", "TaylorO" (Shapira and Firth's methods, as the specification describes them): scaling
//   by N = 2^p with p from sqrt(1-norm x infinity-norm), a Taylor polynomial or a diagonal Padé approximant of degree
//   order (default 8) by Horner's rule, the Padé quotient by the conjugate gradient squared method column by column,
//   then squaring p times. In R the "O" variants differ only in using plain loops instead of BLAS; here all four use
//   plain loops in index order
// - A 1 x 1 matrix gives exp of its entry, a 0 x 0 matrix gives a 0 x 0 matrix

import { fromMat, newMat, requireSquare, toMat, type Mat, type MatrixInput } from "./matrix.js";
import { infNorm, oneNorm } from "./norm.js";
import { gebal } from "./balance.js";
import { solve } from "./solve.js";

/**
 * Methods of {@link expm}.
 *
 * @category Linear algebra
 */
export type ExpmMethod = "Higham08.b" | "Higham08" | "Pade" | "Taylor" | "PadeO" | "TaylorO";

const METHODS: readonly string[] = ["Higham08.b", "Higham08", "Pade", "Taylor", "PadeO", "TaylorO"];

/**
 * Options for {@link expm}.
 *
 * @category Linear algebra
 */
export interface ExpmOptions {
  /**
   * `"Higham08.b"` (default): Higham's scaling and squaring with Padé approximants after balancing (LAPACK's
   * `dgebal`, permutation then scaling). `"Higham08"`: the same without balancing. `"Pade"` and `"Taylor"` (and
   * `"PadeO"`, `"TaylorO"`, which compute the same): scaling and squaring with a diagonal Padé approximant or a
   * Taylor polynomial of degree `order` (Shapira and Firth's code in the expm package).
   */
  method?: ExpmMethod;
  /**
   * Degree of the Padé approximant or the Taylor polynomial (a positive integer), used only by `"Pade"`, `"Taylor"`,
   * `"PadeO"` and `"TaylorO"`. Default: 8.
   */
  order?: number;
}

/**
 * Matrix exponential. Equivalent to `expm::expm(x, method, order)` in R. The methods are `"Higham08.b"` (the
 * default), `"Higham08"`, `"Pade"`, `"Taylor"`, `"PadeO"` and `"TaylorO"`.
 *
 * `"Higham08.b"` and `"Higham08"` use the scaling and squaring method with Padé approximants of degree 3, 5, 7, 9 or
 * 13 (Higham 2005), with or without balancing first, and throw if a linear system of the method is computationally
 * singular. The other methods use scaling and squaring with a Taylor polynomial or a diagonal Padé approximant of
 * degree `order` (the Padé quotient by the conjugate gradient squared method, as expm does).
 *
 * @param x A square matrix (array of rows).
 * @param options See {@link ExpmOptions}.
 * @returns `exp(x)` as an array of rows.
 *
 * @example
 * ```ts
 * expm([[0, 1], [0, 0]]); // [[1, 1], [0, 1]]
 * expm([[0, -1], [1, 0]]); // [[0.5403023059, -0.8414709848], [0.8414709848, 0.5403023059]] (cos 1 and sin 1)
 * ```
 *
 * @category Linear algebra
 */
export function expm(x: MatrixInput, options: ExpmOptions = {}): number[][] {
  const method = options.method ?? "Higham08.b";
  if (!METHODS.includes(method)) throw new RangeError(`unknown method: ${String(method)}`);
  const order = options.order ?? 8;
  if (!Number.isInteger(order) || order < 1) throw new RangeError("order must be a positive integer");
  const A = toMat(x);
  requireSquare(A);
  const n = A.nrow;
  if (n === 0) return [];
  if (n === 1) return [[Math.exp(A.data[0]!)]];
  if (method === "Taylor" || method === "TaylorO") return fromMat(taylorScaled(A, order));
  if (method === "Pade" || method === "PadeO") return fromMat(padeScaled(A, order));
  let perm: ReturnType<typeof gebal> | undefined;
  let scaling: ReturnType<typeof gebal> | undefined;
  if (method === "Higham08.b") {
    perm = gebal("P", A);
    scaling = gebal("S", A);
  }
  const X = pade(A);
  const x_ = X.data;
  const at = (i: number, j: number) => i + j * n;
  if (scaling) {
    const d = scaling.scale;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) x_[at(i, j)] = (x_[at(i, j)]! * d[i]!) / d[j]!;
  }
  if (perm) {
    const p = perm.scale;
    const swap = (i: number) => {
      const k = p[i]!;
      if (k === i) return;
      for (let r = 0; r < n; r++) [x_[at(r, i)], x_[at(r, k)]] = [x_[at(r, k)]!, x_[at(r, i)]!];
      for (let c = 0; c < n; c++) [x_[at(i, c)], x_[at(k, c)]] = [x_[at(k, c)]!, x_[at(i, c)]!];
    };
    for (let i = perm.ilo - 1; i >= 0; i--) swap(i);
    for (let i = perm.ihi + 1; i < n; i++) swap(i);
  }
  return fromMat(X);
}

/** Padé coefficients b_0 ... b_m (Higham 2005, Table 10.4) */
const PADE: Record<3 | 5 | 7 | 9, readonly number[]> = {
  3: [120, 60, 12, 1],
  5: [30240, 15120, 3360, 420, 30, 1],
  7: [17297280, 8648640, 1995840, 277200, 25200, 1512, 56, 1],
  9: [17643225600, 8821612800, 2075673600, 302702400, 30270240, 2162160, 110880, 3960, 90, 1],
};
const PADE13 = [
  64764752532480000, 32382376266240000, 7771770303897600, 1187353796428800, 129060195264000, 10559470521600,
  670442572800, 33522128640, 1323241920, 40840800, 960960, 16380, 182, 1,
];

/** Scaling and squaring with a Padé approximant: exp(A) for the (balanced) matrix A */
function pade(A: Mat): Mat {
  const n = A.nrow;
  const nu = oneNorm(A);
  const I = identity(n);
  let U: Mat;
  let V: Mat;
  let s = 0;
  if (nu <= 2.1) {
    const m = nu <= 0.015 ? 3 : nu <= 0.25 ? 5 : nu <= 0.95 ? 7 : 9;
    const b = PADE[m];
    const A2 = mul(A, A);
    // P_k = A2^k for k = 1 ... (m - 1) / 2, accumulated in increasing order
    const u = comb([[b[1]!, I]]);
    const v = comb([[b[0]!, I]]);
    let P = A2;
    for (let k = 1; k <= (m - 1) / 2; k++) {
      if (k > 1) P = mul(P, A2);
      axpy(u, b[2 * k + 1]!, P);
      axpy(v, b[2 * k]!, P);
    }
    U = mul(A, u);
    V = v;
  } else {
    s = Math.max(0, Math.ceil(Math.log2(nu / 5.4)));
    const B = scale(A, 1 / 2 ** s);
    const B2 = mul(B, B);
    const B4 = mul(B2, B2);
    const B6 = mul(B2, B4);
    const c = PADE13;
    const u1 = comb([[c[13]!, B6], [c[11]!, B4], [c[9]!, B2]]);
    const u2 = mul(B6, u1);
    for (const [k, M] of [[7, B6], [5, B4], [3, B2], [1, I]] as const) axpy(u2, c[k]!, M);
    U = mul(B, u2);
    const v1 = comb([[c[12]!, B6], [c[10]!, B4], [c[8]!, B2]]);
    V = mul(B6, v1);
    for (const [k, M] of [[6, B6], [4, B4], [2, B2], [0, I]] as const) axpy(V, c[k]!, M);
  }
  const vmu = newMat(n, n);
  const vpu = newMat(n, n);
  for (let i = 0; i < n * n; i++) {
    vmu.data[i] = V.data[i]! - U.data[i]!;
    vpu.data[i] = V.data[i]! + U.data[i]!;
  }
  let X = toMat(solve(fromMat(vmu), fromMat(vpu)));
  for (let k = 0; k < s; k++) X = mul(X, X);
  return X;
}

/**
 * Exponent p of the scaling by N = 2^p (Shapira and Firth): with nu = sqrt(|A|_1 |A|_inf), L >= 1 the smallest with
 * 2^L >= nu, p = L + 4
 */
function scalingExponent(A: Mat): number {
  const nu = Math.sqrt(oneNorm(A) * infNorm(A));
  let L = 1;
  while (2 ** L < nu) L++;
  return L + 4;
}

/** R <- R R, p times */
function squareRepeatedly(R: Mat, p: number): Mat {
  for (let k = 0; k < p; k++) R = mul(R, R);
  return R;
}

/** M_ii <- M_ii + 1 */
function addIdentity(M: Mat): void {
  const n = M.nrow;
  for (let i = 0; i < n; i++) M.data[i + i * n] = M.data[i + i * n]! + 1;
}

/** "Taylor": S = I, then S <- (S A) (1 / (j N)) + I for j = order ... 1, then squared p times */
function taylorScaled(A: Mat, order: number): Mat {
  const p = scalingExponent(A);
  const N = 2 ** p;
  let S = identity(A.nrow);
  for (let j = order; j >= 1; j--) {
    S = scale(mul(S, A), 1 / (j * N));
    addIdentity(S);
  }
  return squareRepeatedly(S, p);
}

/** Padé numerator (sign 1) or denominator (sign -1) by Horner's rule: P = I, then P <- (P (sign A)) c_j + I */
function padeHorner(A: Mat, order: number, N: number, sign: 1 | -1): Mat {
  const signedA = sign === 1 ? A : scale(A, -1);
  let P = identity(A.nrow);
  for (let j = order; j >= 1; j--) {
    const c = (order - j + 1) / (j * (2 * order - j + 1) * N);
    P = scale(mul(P, signedA), c);
    addIdentity(P);
  }
  return P;
}

/** "Pade": the diagonal Padé approximant of degree order, Q^-1 P column by column by CGS, then squared p times */
function padeScaled(A: Mat, order: number): Mat {
  const n = A.nrow;
  const p = scalingExponent(A);
  const N = 2 ** p;
  const numer = padeHorner(A, order, N, 1);
  const denom = padeHorner(A, order, N, -1);
  const R = newMat(n, n);
  for (let i = 0; i < n; i++) {
    R.data.set(conjugateGradientSquared(denom, numer.data.subarray(i * n, (i + 1) * n)), i * n);
  }
  return squareRepeatedly(R, p);
}

/** Conjugate gradient squared for M x = f, at most n iterations (as Shapira and Firth's code) */
function conjugateGradientSquared(M: Mat, f: Float64Array): Float64Array {
  const n = M.nrow;
  const TINY = 1e-100;
  const matVec = (v: Float64Array) => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let l = 0; l < n; l++) s += M.data[i + l * n]! * v[l]!;
      y[i] = s;
    }
    return y;
  };
  const dot = (u: Float64Array, v: Float64Array): number => {
    let s = 0;
    for (let i = 0; i < n; i++) s += u[i]! * v[i]!;
    return s;
  };
  /** u + a v */
  const plus = (u: Float64Array, a: number, v: Float64Array) => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = u[i]! + a * v[i]!;
    return y;
  };
  let x = new Float64Array(n);
  let rc = Float64Array.from(f);
  let dir = Float64Array.from(f);
  let u = Float64Array.from(f);
  const rbar = Float64Array.from(f);
  const omegaInit = Math.sqrt(dot(rc, rc));
  let rho0 = dot(rbar, f);
  if (Math.abs(rho0) <= TINY) return x;
  for (let iter = 0; iter < n; iter++) {
    let v = matVec(dir);
    const sigma = dot(rbar, v);
    if (Math.abs(sigma) <= TINY) return x;
    const alpha = rho0 / sigma;
    if (Math.abs(alpha) <= TINY) return x;
    const q = plus(u, -alpha, v);
    v = plus(u, 1, q);
    let s = matVec(v);
    rc = plus(rc, -alpha, s);
    const omega1 = Math.sqrt(dot(rc, rc));
    x = plus(x, alpha, v);
    if (Math.abs(omega1 / omegaInit) <= 1e-30) return x;
    const rho1 = dot(rbar, rc);
    if (Math.abs(rho1) <= TINY) return x;
    const beta = rho1 / rho0;
    rho0 = rho1;
    u = plus(rc, beta, q);
    s = plus(q, beta, dir);
    dir = plus(u, beta, s);
  }
  return x;
}

function identity(n: number): Mat {
  const I = newMat(n, n);
  for (let i = 0; i < n; i++) I.data[i + i * n] = 1;
  return I;
}

/** Matrix product (inner products in increasing order of the summation index) */
function mul(A: Mat, B: Mat): Mat {
  const n = A.nrow;
  const p = A.ncol;
  const q = B.ncol;
  const C = newMat(n, q);
  for (let j = 0; j < q; j++) {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += A.data[i + k * n]! * B.data[k + j * p]!;
      C.data[i + j * n] = s;
    }
  }
  return C;
}

function scale(A: Mat, f: number): Mat {
  return { nrow: A.nrow, ncol: A.ncol, data: A.data.map((v) => v * f) };
}

/** Y <- Y + a M */
function axpy(Y: Mat, a: number, M: Mat): void {
  for (let i = 0; i < Y.data.length; i++) Y.data[i] = Y.data[i]! + a * M.data[i]!;
}

/** a_1 M_1 + a_2 M_2 + ..., summed from left to right */
function comb(terms: readonly (readonly [number, Mat])[]): Mat {
  const [a0, M0] = terms[0]!;
  const Y = scale(M0, a0);
  for (let t = 1; t < terms.length; t++) axpy(Y, terms[t]![0], terms[t]![1]);
  return Y;
}
