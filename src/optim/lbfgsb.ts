// L-BFGS-B: limited-memory quasi-Newton minimisation with bounds on the variables (the method "L-BFGS-B" of optim).
// Ported from the Fortran code of C. Zhu, R. H. Byrd, P. Lu-Chen and J. Nocedal, "L-BFGS-B" version 2.1 on Netlib
// (https://www.netlib.org/opt/lbfgs_bcm.shar, routines.f; no copyright notice), with the MINPACK-2 line search
// dcsrch/dcstep and the LINPACK/BLAS routines it ships with; written for rStats.js. References: R. H. Byrd, P. Lu,
// J. Nocedal and C. Zhu, "A limited memory algorithm for bound constrained optimization", SIAM J. Sci. Comput. 16
// (1995) 1190-1208; C. Zhu, R. H. Byrd, P. Lu, J. Nocedal, "L-BFGS-B: Fortran subroutines for large-scale
// bound-constrained optimization", ACM TOMS 23 (1997) 550-560.
//
// The port keeps the Fortran's 1-based indexing (element 0 of every array is unused) and column-major matrices, so
// that each statement can be compared with the original. The reverse-communication interface of setulb is replaced
// by two callbacks: `evaluate` (task 'FG...') and `newX` (task 'NEW_X', returning true to stop). Printing and timing
// are left out; the machine precision is 2^-52 instead of the computed dpmeps.

/** Result of {@link lbfgsb} */
export interface LbfgsbResult {
  /** The final point */
  x: number[];
  /** f at x */
  f: number;
  /** The final task string ('CONVERGENCE: ...', 'NEW_X' when stopped by newX, 'ABNORMAL_TERMINATION_IN_LNSRCH', 'ERROR: ...') */
  task: string;
  /** Number of evaluations of f and g */
  nfgv: number;
}

const EPSMCH = 2 ** -52;

// --- LINPACK / BLAS (unit stride; `xo` is the index of the first element) ---

function ddot(n: number, x: Float64Array, xo: number, y: Float64Array, yo: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += x[xo + i]! * y[yo + i]!;
  return s;
}

function daxpy(n: number, da: number, x: Float64Array, xo: number, y: Float64Array, yo: number): void {
  if (n <= 0 || da === 0) return;
  for (let i = 0; i < n; i++) y[yo + i] = y[yo + i]! + da * x[xo + i]!;
}

function dcopy(n: number, x: Float64Array, xo: number, y: Float64Array, yo: number): void {
  for (let i = 0; i < n; i++) y[yo + i] = x[xo + i]!;
}

function dscal(n: number, da: number, x: Float64Array, xo: number): void {
  for (let i = 0; i < n; i++) x[xo + i] = da * x[xo + i]!;
}

/** dpofa: Cholesky factor of the matrix a(k, j) = a[base + k + (j - 1) lda], k, j = 1..n (upper triangle used) */
function dpofa(a: Float64Array, base: number, lda: number, n: number): number {
  const A = (k: number, j: number): number => base + k + (j - 1) * lda;
  for (let j = 1; j <= n; j++) {
    let s = 0;
    for (let k = 1; k <= j - 1; k++) {
      let t = a[A(k, j)]! - ddot(k - 1, a, A(1, k), a, A(1, j));
      t = t / a[A(k, k)]!;
      a[A(k, j)] = t;
      s = s + t * t;
    }
    s = a[A(j, j)]! - s;
    if (s <= 0) return j;
    a[A(j, j)] = Math.sqrt(s);
  }
  return 0;
}

/** dtrsl: triangular solve with t(i, j) = t[tb + i + (j - 1) ldt] and b(i) = b[bb + i] */
function dtrsl(t: Float64Array, tb: number, ldt: number, n: number, b: Float64Array, bb: number, job: number): number {
  const T = (i: number, j: number): number => tb + i + (j - 1) * ldt;
  for (let info = 1; info <= n; info++) if (t[T(info, info)] === 0) return info;
  let kase = 1;
  if (job % 10 !== 0) kase = 2;
  if (Math.trunc((job % 100) / 10) !== 0) kase += 2;
  if (kase === 1) {
    // t * x = b, t lower triangular
    b[bb + 1] = b[bb + 1]! / t[T(1, 1)]!;
    for (let j = 2; j <= n; j++) {
      const temp = -b[bb + j - 1]!;
      daxpy(n - j + 1, temp, t, T(j, j - 1), b, bb + j);
      b[bb + j] = b[bb + j]! / t[T(j, j)]!;
    }
  } else if (kase === 2) {
    // t * x = b, t upper triangular
    b[bb + n] = b[bb + n]! / t[T(n, n)]!;
    for (let jj = 2; jj <= n; jj++) {
      const j = n - jj + 1;
      const temp = -b[bb + j + 1]!;
      daxpy(j, temp, t, T(1, j + 1), b, bb + 1);
      b[bb + j] = b[bb + j]! / t[T(j, j)]!;
    }
  } else if (kase === 3) {
    // trans(t) * x = b, t lower triangular
    b[bb + n] = b[bb + n]! / t[T(n, n)]!;
    for (let jj = 2; jj <= n; jj++) {
      const j = n - jj + 1;
      b[bb + j] = b[bb + j]! - ddot(jj - 1, t, T(j + 1, j), b, bb + j + 1);
      b[bb + j] = b[bb + j]! / t[T(j, j)]!;
    }
  } else {
    // trans(t) * x = b, t upper triangular
    b[bb + 1] = b[bb + 1]! / t[T(1, 1)]!;
    for (let j = 2; j <= n; j++) {
      b[bb + j] = b[bb + j]! - ddot(j - 1, t, T(1, j), b, bb + 1);
      b[bb + j] = b[bb + j]! / t[T(j, j)]!;
    }
  }
  return 0;
}

// --- MINPACK-2 line search ---

interface StepState {
  stx: number;
  fx: number;
  dx: number;
  sty: number;
  fy: number;
  dy: number;
  stp: number;
  brackt: boolean;
}

/** dcstep: safeguarded step and update of the interval (fields of s updated in place) */
function dcstep(s: StepState, fp: number, dp: number, stpmin: number, stpmax: number): void {
  const { stx, fx, dx, sty, fy, dy, stp } = s;
  const sgnd = dp * (dx / Math.abs(dx));
  let stpf: number;
  if (fp > fx) {
    const theta = (3 * (fx - fp)) / (stp - stx) + dx + dp;
    const sm = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp));
    let gamma = sm * Math.sqrt((theta / sm) * (theta / sm) - (dx / sm) * (dp / sm));
    if (stp < stx) gamma = -gamma;
    const p = gamma - dx + theta;
    const q = gamma - dx + gamma + dp;
    const r = p / q;
    const stpc = stx + r * (stp - stx);
    const stpq = stx + (dx / ((fx - fp) / (stp - stx) + dx) / 2) * (stp - stx);
    if (Math.abs(stpc - stx) < Math.abs(stpq - stx)) stpf = stpc;
    else stpf = stpc + (stpq - stpc) / 2;
    s.brackt = true;
  } else if (sgnd < 0) {
    const theta = (3 * (fx - fp)) / (stp - stx) + dx + dp;
    const sm = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp));
    let gamma = sm * Math.sqrt((theta / sm) * (theta / sm) - (dx / sm) * (dp / sm));
    if (stp > stx) gamma = -gamma;
    const p = gamma - dp + theta;
    const q = gamma - dp + gamma + dx;
    const r = p / q;
    const stpc = stp + r * (stx - stp);
    const stpq = stp + (dp / (dp - dx)) * (stx - stp);
    if (Math.abs(stpc - stp) > Math.abs(stpq - stp)) stpf = stpc;
    else stpf = stpq;
    s.brackt = true;
  } else if (Math.abs(dp) < Math.abs(dx)) {
    const theta = (3 * (fx - fp)) / (stp - stx) + dx + dp;
    const sm = Math.max(Math.abs(theta), Math.abs(dx), Math.abs(dp));
    let gamma = sm * Math.sqrt(Math.max(0, (theta / sm) * (theta / sm) - (dx / sm) * (dp / sm)));
    if (stp > stx) gamma = -gamma;
    const p = gamma - dp + theta;
    const q = gamma + (dx - dp) + gamma;
    const r = p / q;
    let stpc: number;
    if (r < 0 && gamma !== 0) stpc = stp + r * (stx - stp);
    else if (stp > stx) stpc = stpmax;
    else stpc = stpmin;
    const stpq = stp + (dp / (dp - dx)) * (stx - stp);
    if (s.brackt) {
      if (Math.abs(stpc - stp) < Math.abs(stpq - stp)) stpf = stpc;
      else stpf = stpq;
      if (stp > stx) stpf = Math.min(stp + 0.66 * (sty - stp), stpf);
      else stpf = Math.max(stp + 0.66 * (sty - stp), stpf);
    } else {
      if (Math.abs(stpc - stp) > Math.abs(stpq - stp)) stpf = stpc;
      else stpf = stpq;
      stpf = Math.min(stpmax, stpf);
      stpf = Math.max(stpmin, stpf);
    }
  } else {
    if (s.brackt) {
      const theta = (3 * (fp - fy)) / (sty - stp) + dy + dp;
      const sm = Math.max(Math.abs(theta), Math.abs(dy), Math.abs(dp));
      let gamma = sm * Math.sqrt((theta / sm) * (theta / sm) - (dy / sm) * (dp / sm));
      if (stp > sty) gamma = -gamma;
      const p = gamma - dp + theta;
      const q = gamma - dp + gamma + dy;
      const r = p / q;
      stpf = stp + r * (sty - stp);
    } else if (stp > stx) stpf = stpmax;
    else stpf = stpmin;
  }
  if (fp > fx) {
    s.sty = stp;
    s.fy = fp;
    s.dy = dp;
  } else {
    if (sgnd < 0) {
      s.sty = stx;
      s.fy = fx;
      s.dy = dx;
    }
    s.stx = stp;
    s.fx = fp;
    s.dx = dp;
  }
  s.stp = stpf;
}

/** The saved state of dcsrch between calls */
class Dcsrch {
  private brackt = false;
  private stage = 1;
  private ginit = 0;
  private gtest = 0;
  private gx = 0;
  private gy = 0;
  private finit = 0;
  private fx = 0;
  private fy = 0;
  private stx = 0;
  private sty = 0;
  private stmin = 0;
  private stmax = 0;
  private width = 0;
  private width1 = 0;

  /** One call of dcsrch: returns the new step and task */
  call(f: number, g: number, stpIn: number, ftol: number, gtol: number, xtol: number, stpmin: number, stpmax: number, taskIn: string): { stp: number; task: string } {
    let stp = stpIn;
    let task = taskIn;
    if (task.startsWith("START")) {
      if (stp < stpmin) task = "ERROR: STP .LT. STPMIN";
      if (stp > stpmax) task = "ERROR: STP .GT. STPMAX";
      if (g >= 0) task = "ERROR: INITIAL G .GE. ZERO";
      if (ftol < 0) task = "ERROR: FTOL .LT. ZERO";
      if (gtol < 0) task = "ERROR: GTOL .LT. ZERO";
      if (xtol < 0) task = "ERROR: XTOL .LT. ZERO";
      if (stpmin < 0) task = "ERROR: STPMIN .LT. ZERO";
      if (stpmax < stpmin) task = "ERROR: STPMAX .LT. STPMIN";
      if (task.startsWith("ERROR")) return { stp, task };
      this.brackt = false;
      this.stage = 1;
      this.finit = f;
      this.ginit = g;
      this.gtest = ftol * this.ginit;
      this.width = stpmax - stpmin;
      this.width1 = this.width / 0.5;
      this.stx = 0;
      this.fx = this.finit;
      this.gx = this.ginit;
      this.sty = 0;
      this.fy = this.finit;
      this.gy = this.ginit;
      this.stmin = 0;
      this.stmax = stp + 4 * stp;
      return { stp, task: "FG" };
    }
    const ftest = this.finit + stp * this.gtest;
    if (this.stage === 1 && f <= ftest && g >= 0) this.stage = 2;
    if (this.brackt && (stp <= this.stmin || stp >= this.stmax)) task = "WARNING: ROUNDING ERRORS PREVENT PROGRESS";
    if (this.brackt && this.stmax - this.stmin <= xtol * this.stmax) task = "WARNING: XTOL TEST SATISFIED";
    if (stp === stpmax && f <= ftest && g <= this.gtest) task = "WARNING: STP = STPMAX";
    if (stp === stpmin && (f > ftest || g >= this.gtest)) task = "WARNING: STP = STPMIN";
    if (f <= ftest && Math.abs(g) <= gtol * -this.ginit) task = "CONVERGENCE";
    if (task.startsWith("WARN") || task.startsWith("CONV")) return { stp, task };
    const s: StepState = { stx: this.stx, fx: this.fx, dx: this.gx, sty: this.sty, fy: this.fy, dy: this.gy, stp, brackt: this.brackt };
    if (this.stage === 1 && f <= this.fx && f > ftest) {
      // the modified function psi during the first stage
      const fm = f - stp * this.gtest;
      s.fx = this.fx - this.stx * this.gtest;
      s.fy = this.fy - this.sty * this.gtest;
      const gm = g - this.gtest;
      s.dx = this.gx - this.gtest;
      s.dy = this.gy - this.gtest;
      dcstep(s, fm, gm, this.stmin, this.stmax);
      this.stx = s.stx;
      this.sty = s.sty;
      this.fx = s.fx + s.stx * this.gtest;
      this.fy = s.fy + s.sty * this.gtest;
      this.gx = s.dx + this.gtest;
      this.gy = s.dy + this.gtest;
    } else {
      dcstep(s, f, g, this.stmin, this.stmax);
      this.stx = s.stx;
      this.sty = s.sty;
      this.fx = s.fx;
      this.fy = s.fy;
      this.gx = s.dx;
      this.gy = s.dy;
    }
    this.brackt = s.brackt;
    stp = s.stp;
    if (this.brackt) {
      if (Math.abs(this.sty - this.stx) >= 0.66 * this.width1) stp = this.stx + 0.5 * (this.sty - this.stx);
      this.width1 = this.width;
      this.width = Math.abs(this.sty - this.stx);
    }
    if (this.brackt) {
      this.stmin = Math.min(this.stx, this.sty);
      this.stmax = Math.max(this.stx, this.sty);
    } else {
      this.stmin = stp + 1.1 * (stp - this.stx);
      this.stmax = stp + 4 * (stp - this.stx);
    }
    stp = Math.max(stp, stpmin);
    stp = Math.min(stp, stpmax);
    if ((this.brackt && (stp <= this.stmin || stp >= this.stmax)) || (this.brackt && this.stmax - this.stmin <= xtol * this.stmax)) stp = this.stx;
    return { stp, task: "FG" };
  }
}

/**
 * Minimises f subject to the bounds (mainlb of L-BFGS-B 2.1). `nbd[i]` is 0 (unbounded), 1 (lower bound only), 2
 * (both) or 3 (upper bound only); `m` is the number of corrections kept. `evaluate` returns f and its gradient at x;
 * `newX` is called after each iteration and returns true to stop there.
 */
export function lbfgsb(
  n: number,
  m: number,
  x0: readonly number[],
  lower: readonly number[],
  upper: readonly number[],
  nbd0: readonly number[],
  factr: number,
  pgtol: number,
  evaluate: (x: number[]) => { f: number; g: number[] },
  newX: () => boolean,
): LbfgsbResult {
  const vec = (k: number): Float64Array => new Float64Array(k + 1);
  const x = vec(n);
  const l = vec(n);
  const u = vec(n);
  const g = vec(n);
  const nbd = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    x[i] = x0[i - 1]!;
    l[i] = lower[i - 1]!;
    u[i] = upper[i - 1]!;
    nbd[i] = nbd0[i - 1]!;
  }
  const m2 = 2 * m;
  const ws = new Float64Array(n * m + 1);
  const wy = new Float64Array(n * m + 1);
  const sy = new Float64Array(m * m + 1);
  const ss = new Float64Array(m * m + 1);
  const wt = new Float64Array(m * m + 1);
  const wn = new Float64Array(m2 * m2 + 1);
  const snd = new Float64Array(m2 * m2 + 1);
  const z = vec(n);
  const r = vec(n);
  const d = vec(n);
  const t = vec(n);
  const wa = new Float64Array(8 * m + 1);
  const index = new Int32Array(n + 1);
  const iwhere = new Int32Array(n + 1);
  const indx2 = new Int32Array(n + 1);
  // element (i, j) of ws/wy (n x m), of sy/ss/wt (m x m) and of wn/snd (2m x 2m)
  const W = (i: number, j: number): number => i + (j - 1) * n;
  const M = (i: number, j: number): number => i + (j - 1) * m;
  const K = (i: number, j: number): number => i + (j - 1) * m2;

  let f = 0;
  let col = 0;
  let head = 1;
  let theta = 1;
  let iupdat = 0;
  let updatd = false;
  let iter = 0;
  let nfgv = 0;
  let nint = 0;
  let nfree = n;
  let ileave = 0;
  let nenter = 0;
  let itail = 0;
  let iback = 0;
  let ifun = 0;
  let info = 0;
  let fold = 0;
  let gd = 0;
  let gdold = 0;
  let stp = 0;
  let stpmx = 0;
  let dnorm = 0;
  let dtd = 0;
  let sbgnrm = 0;
  let cnstnd = false;
  let boxed = true;
  const tol = factr * EPSMCH;

  const result = (task: string): LbfgsbResult => ({ x: Array.from(x.subarray(1)), f, task, nfgv });
  const fg = (): void => {
    const e = evaluate(Array.from(x.subarray(1)));
    f = e.f;
    for (let i = 1; i <= n; i++) g[i] = e.g[i - 1]!;
  };

  // errclb
  let task = "START";
  if (n <= 0) task = "ERROR: N .LE. 0";
  if (m <= 0) task = "ERROR: M .LE. 0";
  if (factr < 0) task = "ERROR: FACTR .LT. 0";
  for (let i = 1; i <= n; i++) {
    if (nbd[i]! < 0 || nbd[i]! > 3) task = "ERROR: INVALID NBD";
    if (nbd[i] === 2 && l[i]! > u[i]!) task = "ERROR: NO FEASIBLE SOLUTION";
  }
  if (task.startsWith("ERROR")) return result(task);

  // active: project x onto the feasible set and initialise iwhere
  for (let i = 1; i <= n; i++) {
    if (nbd[i]! > 0) {
      if (nbd[i]! <= 2 && x[i]! <= l[i]!) {
        if (x[i]! < l[i]!) x[i] = l[i]!;
      } else if (nbd[i]! >= 2 && x[i]! >= u[i]!) {
        if (x[i]! > u[i]!) x[i] = u[i]!;
      }
    }
  }
  for (let i = 1; i <= n; i++) {
    if (nbd[i] !== 2) boxed = false;
    if (nbd[i] === 0) iwhere[i] = -1;
    else {
      cnstnd = true;
      iwhere[i] = nbd[i] === 2 && u[i]! - l[i]! <= 0 ? 3 : 0;
    }
  }

  /** projgr: infinity norm of the projected gradient */
  const projgr = (): number => {
    let norm = 0;
    for (let i = 1; i <= n; i++) {
      let gi = g[i]!;
      if (nbd[i] !== 0) {
        if (gi < 0) {
          if (nbd[i]! >= 2) gi = Math.max(x[i]! - u[i]!, gi);
        } else if (nbd[i]! <= 2) gi = Math.min(x[i]! - l[i]!, gi);
      }
      norm = Math.max(norm, Math.abs(gi));
    }
    return norm;
  };

  /** bmv: product of the 2col x 2col middle matrix with v(i) = va[vb + i], into p(i) = pa[pb + i] */
  const bmv = (va: Float64Array, vb: number, pa: Float64Array, pb: number): number => {
    if (col === 0) return 0;
    pa[pb + col + 1] = va[vb + col + 1]!;
    for (let i = 2; i <= col; i++) {
      const i2 = col + i;
      let sum = 0;
      for (let k = 1; k <= i - 1; k++) sum = sum + (sy[M(i, k)]! * va[vb + k]!) / sy[M(k, k)]!;
      pa[pb + i2] = va[vb + i2]! + sum;
    }
    let inf = dtrsl(wt, 0, m, col, pa, pb + col, 11);
    if (inf !== 0) return inf;
    for (let i = 1; i <= col; i++) pa[pb + i] = va[vb + i]! / Math.sqrt(sy[M(i, i)]!);
    inf = dtrsl(wt, 0, m, col, pa, pb + col, 1);
    if (inf !== 0) return inf;
    for (let i = 1; i <= col; i++) pa[pb + i] = -pa[pb + i]! / Math.sqrt(sy[M(i, i)]!);
    for (let i = 1; i <= col; i++) {
      let sum = 0;
      for (let k = i + 1; k <= col; k++) sum = sum + (sy[M(k, i)]! * pa[pb + col + k]!) / sy[M(i, i)]!;
      pa[pb + i] = pa[pb + i]! + sum;
    }
    return 0;
  };

  /** hpsolb: moves the least of t(1..nn) to t(nn) and keeps the others as a heap (iorder = indx2) */
  const hpsolb = (nn: number, iheap: number): void => {
    if (iheap === 0) {
      for (let k = 2; k <= nn; k++) {
        const ddum = t[k]!;
        const indxin = indx2[k]!;
        let i = k;
        while (i > 1) {
          const j = Math.trunc(i / 2);
          if (ddum < t[j]!) {
            t[i] = t[j]!;
            indx2[i] = indx2[j]!;
            i = j;
          } else break;
        }
        t[i] = ddum;
        indx2[i] = indxin;
      }
    }
    if (nn > 1) {
      let i = 1;
      const out = t[1]!;
      const indxou = indx2[1]!;
      const ddum = t[nn]!;
      const indxin = indx2[nn]!;
      for (;;) {
        let j = i + i;
        if (j <= nn - 1) {
          if (t[j + 1]! < t[j]!) j = j + 1;
          if (t[j]! < ddum) {
            t[i] = t[j]!;
            indx2[i] = indx2[j]!;
            i = j;
            continue;
          }
        }
        break;
      }
      t[i] = ddum;
      indx2[i] = indxin;
      t[nn] = out;
      indx2[nn] = indxou;
    }
  };

  /** cauchy: the generalized Cauchy point, into z (xcp); p = wa(1), c = wa(2m+1), wbp = wa(4m+1), v = wa(6m+1) */
  const cauchy = (): number => {
    const P = 0;
    const C = 2 * m;
    const WBP = 4 * m;
    const V = 6 * m;
    if (sbgnrm <= 0) {
      dcopy(n, x, 1, z, 1);
      return 0;
    }
    let bnded = true;
    let nfreec = n + 1;
    let nbreak = 0;
    let ibkmin = 0;
    let bkmin = 0;
    const col2 = 2 * col;
    let f1 = 0;
    for (let i = 1; i <= col2; i++) wa[P + i] = 0;
    let tl = 0;
    let tu = 0;
    for (let i = 1; i <= n; i++) {
      const neggi = -g[i]!;
      if (iwhere[i] !== 3 && iwhere[i] !== -1) {
        if (nbd[i]! <= 2) tl = x[i]! - l[i]!;
        if (nbd[i]! >= 2) tu = u[i]! - x[i]!;
        const xlower = nbd[i]! <= 2 && tl <= 0;
        const xupper = nbd[i]! >= 2 && tu <= 0;
        iwhere[i] = 0;
        if (xlower) {
          if (neggi <= 0) iwhere[i] = 1;
        } else if (xupper) {
          if (neggi >= 0) iwhere[i] = 2;
        } else if (Math.abs(neggi) <= 0) iwhere[i] = -3;
      }
      let pointr = head;
      if (iwhere[i] !== 0 && iwhere[i] !== -1) d[i] = 0;
      else {
        d[i] = neggi;
        f1 = f1 - neggi * neggi;
        for (let j = 1; j <= col; j++) {
          wa[P + j] = wa[P + j]! + wy[W(i, pointr)]! * neggi;
          wa[P + col + j] = wa[P + col + j]! + ws[W(i, pointr)]! * neggi;
          pointr = (pointr % m) + 1;
        }
        if (nbd[i]! <= 2 && nbd[i] !== 0 && neggi < 0) {
          nbreak = nbreak + 1;
          indx2[nbreak] = i;
          t[nbreak] = tl / -neggi;
          if (nbreak === 1 || t[nbreak]! < bkmin) {
            bkmin = t[nbreak]!;
            ibkmin = nbreak;
          }
        } else if (nbd[i]! >= 2 && neggi > 0) {
          nbreak = nbreak + 1;
          indx2[nbreak] = i;
          t[nbreak] = tu / neggi;
          if (nbreak === 1 || t[nbreak]! < bkmin) {
            bkmin = t[nbreak]!;
            ibkmin = nbreak;
          }
        } else {
          nfreec = nfreec - 1;
          indx2[nfreec] = i;
          if (Math.abs(neggi) > 0) bnded = false;
        }
      }
    }
    if (theta !== 1) dscal(col, theta, wa, P + col + 1);
    dcopy(n, x, 1, z, 1);
    if (nbreak === 0 && nfreec === n + 1) return 0;
    for (let j = 1; j <= col2; j++) wa[C + j] = 0;
    let f2 = -theta * f1;
    if (col > 0) {
      const inf = bmv(wa, P, wa, V);
      if (inf !== 0) return inf;
      f2 = f2 - ddot(col2, wa, V + 1, wa, P + 1);
    }
    let dtm = -f1 / f2;
    let tsum = 0;
    nint = 1;
    let allFixed = false;
    if (nbreak !== 0) {
      let nleft = nbreak;
      let it = 1;
      let tj = 0;
      for (;;) {
        const tj0 = tj;
        let ibp: number;
        if (it === 1) {
          tj = bkmin;
          ibp = indx2[ibkmin]!;
        } else {
          if (it === 2) {
            if (ibkmin !== nbreak) {
              t[ibkmin] = t[nbreak]!;
              indx2[ibkmin] = indx2[nbreak]!;
            }
          }
          hpsolb(nleft, it - 2);
          tj = t[nleft]!;
          ibp = indx2[nleft]!;
        }
        const dt = tj - tj0;
        if (dtm < dt) break;
        tsum = tsum + dt;
        nleft = nleft - 1;
        it = it + 1;
        const dibp = d[ibp]!;
        d[ibp] = 0;
        let zibp: number;
        if (dibp > 0) {
          zibp = u[ibp]! - x[ibp]!;
          z[ibp] = u[ibp]!;
          iwhere[ibp] = 2;
        } else {
          zibp = l[ibp]! - x[ibp]!;
          z[ibp] = l[ibp]!;
          iwhere[ibp] = 1;
        }
        if (nleft === 0 && nbreak === n) {
          dtm = dt;
          allFixed = true;
          break;
        }
        nint = nint + 1;
        const dibp2 = dibp * dibp;
        f1 = f1 + dt * f2 + dibp2 - theta * dibp * zibp;
        f2 = f2 - theta * dibp2;
        if (col > 0) {
          daxpy(col2, dt, wa, P + 1, wa, C + 1);
          let pointr = head;
          for (let j = 1; j <= col; j++) {
            wa[WBP + j] = wy[W(ibp, pointr)]!;
            wa[WBP + col + j] = theta * ws[W(ibp, pointr)]!;
            pointr = (pointr % m) + 1;
          }
          const inf = bmv(wa, WBP, wa, V);
          if (inf !== 0) return inf;
          const wmc = ddot(col2, wa, C + 1, wa, V + 1);
          const wmp = ddot(col2, wa, P + 1, wa, V + 1);
          const wmw = ddot(col2, wa, WBP + 1, wa, V + 1);
          daxpy(col2, -dibp, wa, WBP + 1, wa, P + 1);
          f1 = f1 + dibp * wmc;
          f2 = f2 + 2 * dibp * wmp - dibp2 * wmw;
        }
        if (nleft > 0) {
          dtm = -f1 / f2;
          continue;
        } else if (bnded) {
          f1 = 0;
          f2 = 0;
          dtm = 0;
        } else dtm = -f1 / f2;
        break;
      }
    }
    if (!allFixed) {
      if (dtm <= 0) dtm = 0;
      tsum = tsum + dtm;
      daxpy(n, tsum, d, 1, z, 1);
    }
    if (col > 0) daxpy(col2, dtm, wa, P + 1, wa, C + 1);
    return 0;
  };

  /** freev: entering and leaving variables, and the free and active sets at the GCP; returns wrk */
  const freev = (): boolean => {
    nenter = 0;
    ileave = n + 1;
    if (iter > 0 && cnstnd) {
      for (let i = 1; i <= nfree; i++) {
        const k = index[i]!;
        if (iwhere[k]! > 0) {
          ileave = ileave - 1;
          indx2[ileave] = k;
        }
      }
      for (let i = 1 + nfree; i <= n; i++) {
        const k = index[i]!;
        if (iwhere[k]! <= 0) {
          nenter = nenter + 1;
          indx2[nenter] = k;
        }
      }
    }
    const wrk = ileave < n + 1 || nenter > 0 || updatd;
    nfree = 0;
    let iact = n + 1;
    for (let i = 1; i <= n; i++) {
      if (iwhere[i]! <= 0) {
        nfree = nfree + 1;
        index[nfree] = i;
      } else {
        iact = iact - 1;
        index[iact] = i;
      }
    }
    return wrk;
  };

  /** formk: the LEL^T factorization of the indefinite matrix K in wn (wn1 = snd) */
  const formk = (): number => {
    const nsub = nfree;
    let upcl: number;
    if (updatd) {
      if (iupdat > m) {
        for (let jy = 1; jy <= m - 1; jy++) {
          const js = m + jy;
          dcopy(m - jy, snd, K(jy + 1, jy + 1), snd, K(jy, jy));
          dcopy(m - jy, snd, K(js + 1, js + 1), snd, K(js, js));
          dcopy(m - 1, snd, K(m + 2, jy + 1), snd, K(m + 1, jy));
        }
      }
      const pbegin = 1;
      const pend = nsub;
      const dbegin = nsub + 1;
      const dend = n;
      const iy = col;
      const is = m + col;
      let ipntr = head + col - 1;
      if (ipntr > m) ipntr = ipntr - m;
      let jpntr = head;
      for (let jy = 1; jy <= col; jy++) {
        const js = m + jy;
        let temp1 = 0;
        let temp2 = 0;
        let temp3 = 0;
        for (let k = pbegin; k <= pend; k++) {
          const k1 = index[k]!;
          temp1 = temp1 + wy[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
        }
        for (let k = dbegin; k <= dend; k++) {
          const k1 = index[k]!;
          temp2 = temp2 + ws[W(k1, ipntr)]! * ws[W(k1, jpntr)]!;
          temp3 = temp3 + ws[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
        }
        snd[K(iy, jy)] = temp1;
        snd[K(is, js)] = temp2;
        snd[K(is, jy)] = temp3;
        jpntr = (jpntr % m) + 1;
      }
      const jy = col;
      jpntr = head + col - 1;
      if (jpntr > m) jpntr = jpntr - m;
      ipntr = head;
      for (let i = 1; i <= col; i++) {
        const is2 = m + i;
        let temp3 = 0;
        for (let k = pbegin; k <= pend; k++) {
          const k1 = index[k]!;
          temp3 = temp3 + ws[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
        }
        ipntr = (ipntr % m) + 1;
        snd[K(is2, jy)] = temp3;
      }
      upcl = col - 1;
    } else upcl = col;

    let ipntr = head;
    for (let iy = 1; iy <= upcl; iy++) {
      const is = m + iy;
      let jpntr = head;
      for (let jy = 1; jy <= iy; jy++) {
        const js = m + jy;
        let temp1 = 0;
        let temp2 = 0;
        let temp3 = 0;
        let temp4 = 0;
        for (let k = 1; k <= nenter; k++) {
          const k1 = indx2[k]!;
          temp1 = temp1 + wy[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
          temp2 = temp2 + ws[W(k1, ipntr)]! * ws[W(k1, jpntr)]!;
        }
        for (let k = ileave; k <= n; k++) {
          const k1 = indx2[k]!;
          temp3 = temp3 + wy[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
          temp4 = temp4 + ws[W(k1, ipntr)]! * ws[W(k1, jpntr)]!;
        }
        snd[K(iy, jy)] = snd[K(iy, jy)]! + temp1 - temp3;
        snd[K(is, js)] = snd[K(is, js)]! - temp2 + temp4;
        jpntr = (jpntr % m) + 1;
      }
      ipntr = (ipntr % m) + 1;
    }
    ipntr = head;
    for (let is = m + 1; is <= m + upcl; is++) {
      let jpntr = head;
      for (let jy = 1; jy <= upcl; jy++) {
        let temp1 = 0;
        let temp3 = 0;
        for (let k = 1; k <= nenter; k++) {
          const k1 = indx2[k]!;
          temp1 = temp1 + ws[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
        }
        for (let k = ileave; k <= n; k++) {
          const k1 = indx2[k]!;
          temp3 = temp3 + ws[W(k1, ipntr)]! * wy[W(k1, jpntr)]!;
        }
        if (is <= jy + m) snd[K(is, jy)] = snd[K(is, jy)]! + temp1 - temp3;
        else snd[K(is, jy)] = snd[K(is, jy)]! - temp1 + temp3;
        jpntr = (jpntr % m) + 1;
      }
      ipntr = (ipntr % m) + 1;
    }
    for (let iy = 1; iy <= col; iy++) {
      const is = col + iy;
      const is1 = m + iy;
      for (let jy = 1; jy <= iy; jy++) {
        const js = col + jy;
        const js1 = m + jy;
        wn[K(jy, iy)] = snd[K(iy, jy)]! / theta;
        wn[K(js, is)] = snd[K(is1, js1)]! * theta;
      }
      for (let jy = 1; jy <= iy - 1; jy++) wn[K(jy, is)] = -snd[K(is1, jy)]!;
      for (let jy = iy; jy <= col; jy++) wn[K(jy, is)] = snd[K(is1, jy)]!;
      wn[K(iy, iy)] = wn[K(iy, iy)]! + sy[M(iy, iy)]!;
    }
    let inf = dpofa(wn, 0, m2, col);
    if (inf !== 0) return -1;
    const col2 = 2 * col;
    for (let js = col + 1; js <= col2; js++) dtrsl(wn, 0, m2, col, wn, K(1, js) - 1, 11);
    for (let is = col + 1; is <= col2; is++) {
      for (let js = is; js <= col2; js++) wn[K(is, js)] = wn[K(is, js)]! + ddot(col, wn, K(1, is), wn, K(1, js));
    }
    inf = dpofa(wn, col + col * m2, m2, col);
    if (inf !== 0) return -2;
    return 0;
  };

  /** cmprlb: r = -Z'B(xcp - xk) - Z'g, using wa(2m+1) = W'(xcp - x) from cauchy */
  const cmprlb = (): number => {
    if (!cnstnd && col > 0) {
      for (let i = 1; i <= n; i++) r[i] = -g[i]!;
    } else {
      for (let i = 1; i <= nfree; i++) {
        const k = index[i]!;
        r[i] = -theta * (z[k]! - x[k]!) - g[k]!;
      }
      const inf = bmv(wa, 2 * m, wa, 0);
      if (inf !== 0) return -8;
      let pointr = head;
      for (let j = 1; j <= col; j++) {
        const a1 = wa[j]!;
        const a2 = theta * wa[col + j]!;
        for (let i = 1; i <= nfree; i++) {
          const k = index[i]!;
          r[i] = r[i]! + wy[W(k, pointr)]! * a1 + ws[W(k, pointr)]! * a2;
        }
        pointr = (pointr % m) + 1;
      }
    }
    return 0;
  };

  /** subsm: subspace minimisation along the Newton direction, from z (xcp) with the reduced gradient in r */
  const subsm = (): number => {
    const nsub = nfree;
    if (nsub <= 0) return 0;
    // wv = wa(1..2m)
    let pointr = head;
    for (let i = 1; i <= col; i++) {
      let temp1 = 0;
      let temp2 = 0;
      for (let j = 1; j <= nsub; j++) {
        const k = index[j]!;
        temp1 = temp1 + wy[W(k, pointr)]! * r[j]!;
        temp2 = temp2 + ws[W(k, pointr)]! * r[j]!;
      }
      wa[i] = temp1;
      wa[col + i] = theta * temp2;
      pointr = (pointr % m) + 1;
    }
    const col2 = 2 * col;
    let inf = dtrsl(wn, 0, m2, col2, wa, 0, 11);
    if (inf !== 0) return inf;
    for (let i = 1; i <= col; i++) wa[i] = -wa[i]!;
    inf = dtrsl(wn, 0, m2, col2, wa, 0, 1);
    if (inf !== 0) return inf;
    pointr = head;
    for (let jy = 1; jy <= col; jy++) {
      const js = col + jy;
      for (let i = 1; i <= nsub; i++) {
        const k = index[i]!;
        r[i] = r[i]! + (wy[W(k, pointr)]! * wa[jy]!) / theta + ws[W(k, pointr)]! * wa[js]!;
      }
      pointr = (pointr % m) + 1;
    }
    for (let i = 1; i <= nsub; i++) r[i] = r[i]! / theta;
    // backtrack to the feasible region
    let alpha = 1;
    let temp1 = alpha;
    let ibd = 0;
    for (let i = 1; i <= nsub; i++) {
      const k = index[i]!;
      const dk = r[i]!;
      if (nbd[k] !== 0) {
        if (dk < 0 && nbd[k]! <= 2) {
          const temp2 = l[k]! - z[k]!;
          if (temp2 >= 0) temp1 = 0;
          else if (dk * alpha < temp2) temp1 = temp2 / dk;
        } else if (dk > 0 && nbd[k]! >= 2) {
          const temp2 = u[k]! - z[k]!;
          if (temp2 <= 0) temp1 = 0;
          else if (dk * alpha > temp2) temp1 = temp2 / dk;
        }
        if (temp1 < alpha) {
          alpha = temp1;
          ibd = i;
        }
      }
    }
    if (alpha < 1) {
      const dk = r[ibd]!;
      const k = index[ibd]!;
      if (dk > 0) {
        z[k] = u[k]!;
        r[ibd] = 0;
      } else if (dk < 0) {
        z[k] = l[k]!;
        r[ibd] = 0;
      }
    }
    for (let i = 1; i <= nsub; i++) {
      const k = index[i]!;
      z[k] = z[k]! + alpha * r[i]!;
    }
    return 0;
  };

  /** matupd: updates WS, WY, SY and SS (with d = s and r = y) */
  const matupd = (rr: number, dr: number): void => {
    if (iupdat <= m) {
      col = iupdat;
      itail = ((head + iupdat - 2) % m) + 1;
    } else {
      itail = (itail % m) + 1;
      head = (head % m) + 1;
    }
    dcopy(n, d, 1, ws, W(1, itail));
    dcopy(n, r, 1, wy, W(1, itail));
    theta = rr / dr;
    if (iupdat > m) {
      for (let j = 1; j <= col - 1; j++) {
        dcopy(j, ss, M(2, j + 1), ss, M(1, j));
        dcopy(col - j, sy, M(j + 1, j + 1), sy, M(j, j));
      }
    }
    let pointr = head;
    for (let j = 1; j <= col - 1; j++) {
      sy[M(col, j)] = ddot(n, d, 1, wy, W(1, pointr));
      ss[M(j, col)] = ddot(n, ws, W(1, pointr), d, 1);
      pointr = (pointr % m) + 1;
    }
    if (stp === 1) ss[M(col, col)] = dtd;
    else ss[M(col, col)] = stp * stp * dtd;
    sy[M(col, col)] = dr;
  };

  /** formt: T = theta*SS + L*D^(-1)*L' in the upper triangle of wt, and its Cholesky factor */
  const formt = (): number => {
    for (let j = 1; j <= col; j++) wt[M(1, j)] = theta * ss[M(1, j)]!;
    for (let i = 2; i <= col; i++) {
      for (let j = i; j <= col; j++) {
        const k1 = Math.min(i, j) - 1;
        let ddum = 0;
        for (let k = 1; k <= k1; k++) ddum = ddum + (sy[M(i, k)]! * sy[M(j, k)]!) / sy[M(k, k)]!;
        wt[M(i, j)] = ddum + theta * ss[M(i, j)]!;
      }
    }
    return dpofa(wt, 0, m, col) !== 0 ? -3 : 0;
  };

  // lnsrlb: the line search (ftol 1e-3, gtol 0.9, xtol 0.1)
  const search = new Dcsrch();
  let csave = "START";
  const lnsrlbStart = (): void => {
    dtd = ddot(n, d, 1, d, 1);
    dnorm = Math.sqrt(dtd);
    stpmx = 1e10;
    if (cnstnd) {
      if (iter === 0) stpmx = 1;
      else {
        for (let i = 1; i <= n; i++) {
          const a1 = d[i]!;
          if (nbd[i] !== 0) {
            if (a1 < 0 && nbd[i]! <= 2) {
              const a2 = l[i]! - x[i]!;
              if (a2 >= 0) stpmx = 0;
              else if (a1 * stpmx < a2) stpmx = a2 / a1;
            } else if (a1 > 0 && nbd[i]! >= 2) {
              const a2 = u[i]! - x[i]!;
              if (a2 <= 0) stpmx = 0;
              else if (a1 * stpmx > a2) stpmx = a2 / a1;
            }
          }
        }
      }
    }
    if (iter === 0 && !boxed) stp = Math.min(1 / dnorm, stpmx);
    else stp = 1;
    dcopy(n, x, 1, t, 1);
    dcopy(n, g, 1, r, 1);
    fold = f;
    ifun = 0;
    iback = 0;
    csave = "START";
  };
  /** One pass of lnsrlb from label 556: 'FG_LNSRCH' (x set to the next trial point) or 'NEW_X'; info = -4 on an uphill direction */
  const lnsrlbStep = (): string => {
    gd = ddot(n, g, 1, d, 1);
    if (ifun === 0) {
      gdold = gd;
      if (gd >= 0) {
        info = -4;
        return task;
      }
    }
    const res = search.call(f, gd, stp, 1e-3, 0.9, 0.1, 0, stpmx, csave);
    stp = res.stp;
    csave = res.task;
    if (!csave.startsWith("CONV") && !csave.startsWith("WARN")) {
      ifun = ifun + 1;
      nfgv = nfgv + 1;
      iback = ifun - 1;
      if (stp === 1) dcopy(n, z, 1, x, 1);
      else for (let i = 1; i <= n; i++) x[i] = stp * d[i]! + t[i]!;
      return "FG_LNSRCH";
    }
    return "NEW_X";
  };

  const refresh = (): void => {
    info = 0;
    col = 0;
    head = 1;
    theta = 1;
    iupdat = 0;
    updatd = false;
  };

  task = "FG_START";
  fg();
  nfgv = 1;
  sbgnrm = projgr();
  if (sbgnrm <= pgtol) return result("CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL");

  for (;;) {
    // label 222: the beginning of the loop
    let wrk: boolean;
    if (!cnstnd && col > 0) {
      dcopy(n, x, 1, z, 1);
      wrk = updatd;
      nint = 0;
    } else {
      info = cauchy();
      if (info !== 0) {
        refresh();
        continue;
      }
      wrk = freev();
    }
    // label 333: subspace minimisation
    if (!(nfree === 0 || col === 0)) {
      if (wrk) info = formk();
      if (info !== 0) {
        refresh();
        continue;
      }
      info = cmprlb();
      if (info === 0) info = subsm();
      if (info !== 0) {
        refresh();
        continue;
      }
    }
    // label 555: line search
    for (let i = 1; i <= n; i++) d[i] = z[i]! - x[i]!;
    lnsrlbStart();
    for (;;) {
      task = lnsrlbStep();
      if (info !== 0 || iback >= 20) break;
      if (task !== "FG_LNSRCH") break;
      fg();
    }
    if (info !== 0 || iback >= 20) {
      dcopy(n, t, 1, x, 1);
      dcopy(n, r, 1, g, 1);
      f = fold;
      if (col === 0) {
        if (info === 0) {
          info = -9;
          nfgv = nfgv - 1;
          ifun = ifun - 1;
          iback = iback - 1;
        }
        iter = iter + 1;
        return result("ABNORMAL_TERMINATION_IN_LNSRCH");
      }
      if (info === 0) nfgv = nfgv - 1;
      refresh();
      task = "RESTART_FROM_LNSRCH";
      continue;
    }
    iter = iter + 1;
    sbgnrm = projgr();
    if (newX()) return result("NEW_X");
    // label 777: tests for termination
    if (sbgnrm <= pgtol) return result("CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL");
    let ddum = Math.max(Math.abs(fold), Math.abs(f), 1);
    if (fold - f <= tol * ddum) return result("CONVERGENCE: REL_REDUCTION_OF_F <= FACTR*EPSMCH");
    for (let i = 1; i <= n; i++) r[i] = g[i]! - r[i]!;
    const rr = ddot(n, r, 1, r, 1);
    let dr: number;
    if (stp === 1) {
      dr = gd - gdold;
      ddum = -gdold;
    } else {
      dr = (gd - gdold) * stp;
      dscal(n, stp, d, 1);
      ddum = -gdold * stp;
    }
    if (dr <= EPSMCH * ddum) {
      // skip the L-BFGS update
      updatd = false;
      continue;
    }
    updatd = true;
    iupdat = iupdat + 1;
    matupd(rr, dr);
    info = formt();
    if (info !== 0) refresh();
  }
}
