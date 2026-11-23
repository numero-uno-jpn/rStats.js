// All eigenvalues and the k leading eigenvectors of a real symmetric matrix (internal; used by cmdscale).
//
// Textbook methods (Golub & Van Loan, "Matrix Computations", 4th ed., 8.3.1 Householder tridiagonalisation, 8.4.1
// Sturm sequence bisection, 8.2.2 inverse iteration; Wilkinson, "The Algebraic Eigenvalue Problem"): the reflectors
// are kept instead of the orthogonal matrix, so the cost is about (4/3) n^3 for the reduction and O(k n^2) for the
// vectors, against several n^3 for all eigenvectors (eigen's tred2 + tql2). Written for rStats.js (no ported code).

export interface SymmetricLeading {
  /** All n eigenvalues, decreasing. */
  values: number[];
  /** The first k eigenvectors (unit length), vectors[j] for values[j]. */
  vectors: number[][];
}

/** a: the matrix as rows (only the lower triangle is read); k: how many leading eigenvectors */
export function symmetricLeading(a: readonly (readonly number[])[], k: number): SymmetricLeading {
  const n = a.length;
  // full symmetric copy from the lower triangle, row-major
  const m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { const v = a[i]![j]!; m[i * n + j] = v; m[j * n + i] = v; }
  const diag = new Float64Array(n), off = new Float64Array(n); // off[i] couples i and i + 1
  const reflectors: { v: Float64Array; beta: number }[] = [];
  const p = new Float64Array(n), w = new Float64Array(n);
  for (let c = 0; c < n - 2; c++) {
    const len = n - c - 1;
    const v = new Float64Array(len);
    let scale = 0;
    for (let i = 0; i < len; i++) scale = Math.max(scale, Math.abs(m[(c + 1 + i) * n + c]!));
    if (scale === 0) { reflectors.push({ v, beta: 0 }); off[c] = 0; diag[c] = m[c * n + c]!; continue; }
    let sigma = 0;
    for (let i = 0; i < len; i++) { v[i] = m[(c + 1 + i) * n + c]! / scale; sigma += v[i]! * v[i]!; }
    const x0 = v[0]!, norm = Math.sqrt(sigma);
    const alpha = x0 >= 0 ? -norm : norm; // H x = alpha e1 (in units of scale)
    v[0] = x0 - alpha;
    const vv = sigma - x0 * x0 + v[0]! * v[0]!;
    const beta = vv === 0 ? 0 : 2 / vv;
    reflectors.push({ v, beta });
    diag[c] = m[c * n + c]!;
    off[c] = alpha * scale;
    if (beta === 0) continue;
    // trailing block B (rows and columns c+1..n-1): B <- H B H = B - v w' - w v', p = beta B v, w = p - (beta p'v / 2) v
    let pv = 0;
    for (let i = 0; i < len; i++) {
      let s = 0;
      const row = (c + 1 + i) * n + c + 1;
      for (let j = 0; j < len; j++) s += m[row + j]! * v[j]!;
      p[i] = beta * s;
      pv += p[i]! * v[i]!;
    }
    const half = beta * pv / 2;
    for (let i = 0; i < len; i++) w[i] = p[i]! - half * v[i]!;
    for (let i = 0; i < len; i++) {
      const row = (c + 1 + i) * n + c + 1, vi = v[i]!, wi = w[i]!;
      for (let j = 0; j < len; j++) m[row + j] = m[row + j]! - vi * w[j]! - wi * v[j]!;
    }
  }
  if (n >= 2) { diag[n - 2] = m[(n - 2) * n + n - 2]!; off[n - 2] = m[(n - 1) * n + n - 2]!; }
  diag[n - 1] = m[(n - 1) * n + n - 1]!;

  // T is divided by a power of two near its largest entry (exact), so that the squares in the Sturm sequence neither
  // overflow nor underflow at extreme scales (cmdscale_scale: entries near 1e301); the eigenvalues are multiplied back
  let big = 0;
  for (let i = 0; i < n; i++) big = Math.max(big, Math.abs(diag[i]!), Math.abs(off[i]!));
  const unit = big > 0 && Number.isFinite(big) ? 2 ** Math.round(Math.log2(big)) : 1;
  for (let i = 0; i < n; i++) { diag[i] = diag[i]! / unit; off[i] = off[i]! / unit; }
  // eigenvalues of the tridiagonal matrix by bisection on the Sturm sequence count
  let lo = Infinity, hi = -Infinity, tnorm = 0;
  for (let i = 0; i < n; i++) {
    const r = (i > 0 ? Math.abs(off[i - 1]!) : 0) + (i < n - 1 ? Math.abs(off[i]!) : 0);
    lo = Math.min(lo, diag[i]! - r); hi = Math.max(hi, diag[i]! + r); tnorm = Math.max(tnorm, Math.abs(diag[i]!) + r);
  }
  const tiny = Number.MIN_VALUE / Number.EPSILON;
  /** number of eigenvalues below x */
  const below = (x: number): number => {
    let count = 0, q = 1;
    for (let i = 0; i < n; i++) {
      const b2 = i > 0 ? off[i - 1]! * off[i - 1]! : 0;
      q = diag[i]! - x - (i > 0 ? b2 / q : 0);
      if (q === 0) q = -tiny * Math.max(1, tnorm);
      if (q < 0) count++;
    }
    return count;
  };
  const values = new Array<number>(n);
  for (let r = 0; r < n; r++) { // the r-th largest is the (n - 1 - r)-th smallest
    const target = n - 1 - r;
    let a0 = lo, b0 = hi;
    for (let it = 0; it < 2200; it++) {
      const mid = a0 + (b0 - a0) / 2;
      if (mid === a0 || mid === b0) break;
      // bisection cannot resolve below about eps times the norm: stop there (a 0 eigenvalue would otherwise take
      // some 1000 halvings down to the subnormals)
      if (b0 - a0 <= Math.max(2 * Number.EPSILON * Math.max(Math.abs(a0), Math.abs(b0)), Number.EPSILON * tnorm / n)) break;
      if (below(mid) > target) b0 = mid; else a0 = mid;
    }
    values[r] = a0 + (b0 - a0) / 2;
  }

  const scaled = values.slice();
  for (let r = 0; r < n; r++) values[r] = values[r]! * unit;
  // leading eigenvectors of T by inverse iteration, orthogonalised within close groups, then z <- H_0 ... H_{n-3} z
  const vectors: number[][] = [];
  const done: Float64Array[] = [];
  const groupTol = 1e-3 * Math.max(tnorm, tiny);
  for (let j = 0; j < Math.min(k, n); j++) {
    const lambda = scaled[j]!;
    let z: Float64Array = new Float64Array(n);
    for (let i = 0; i < n; i++) z[i] = 1 / Math.sqrt(n) * (1 + ((i * 7919 + j * 104729) % 1000) / 1000); // deterministic start
    const shift = lambda + Number.EPSILON * Math.max(tnorm, tiny) * (1 + j);
    for (let it = 0; it < 4; it++) {
      z = solveShifted(diag, off, shift, z, tnorm);
      for (let g = 0; g < done.length; g++) {
        if (Math.abs(scaled[g]! - lambda) > groupTol) continue;
        let dot = 0;
        for (let i = 0; i < n; i++) dot += done[g]![i]! * z[i]!;
        for (let i = 0; i < n; i++) z[i] = z[i]! - dot * done[g]![i]!;
      }
      let s = 0;
      for (let i = 0; i < n; i++) s = Math.max(s, Math.abs(z[i]!));
      if (s === 0) { z[j % n] = 1; s = 1; }
      let nn = 0;
      for (let i = 0; i < n; i++) { z[i] = z[i]! / s; nn += z[i]! * z[i]!; }
      nn = Math.sqrt(nn);
      for (let i = 0; i < n; i++) z[i] = z[i]! / nn;
    }
    done.push(Float64Array.from(z));
    const y = Float64Array.from(z);
    for (let c = reflectors.length - 1; c >= 0; c--) {
      const { v, beta } = reflectors[c]!;
      if (beta === 0) continue;
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += v[i]! * y[c + 1 + i]!;
      const f = beta * dot;
      for (let i = 0; i < v.length; i++) y[c + 1 + i] = y[c + 1 + i]! - f * v[i]!;
    }
    vectors.push(Array.from(y));
  }
  return { values, vectors };
}

/** Solve (T - s I) x = b for the tridiagonal T (diag, off) by Gaussian elimination with partial pivoting */
function solveShifted(diag: Float64Array, off: Float64Array, s: number, b: Float64Array, tnorm: number): Float64Array {
  const n = diag.length;
  if (n === 1) { const d = diag[0]! - s; return Float64Array.of(b[0]! / (d === 0 ? Number.EPSILON * Math.max(tnorm, 1) : d)); }
  // rows hold (sub, main, super, super2) after pivoting
  const dl = new Float64Array(n), dm = new Float64Array(n), du = new Float64Array(n), du2 = new Float64Array(n);
  const x = Float64Array.from(b);
  for (let i = 0; i < n; i++) { dm[i] = diag[i]! - s; if (i < n - 1) { du[i] = off[i]!; dl[i + 1] = off[i]!; } }
  const eps = Number.EPSILON * Math.max(tnorm, Number.MIN_VALUE);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(dm[i]!) >= Math.abs(dl[i + 1]!)) {
      if (dm[i] === 0) dm[i] = eps;
      const f = dl[i + 1]! / dm[i]!;
      dm[i + 1] = dm[i + 1]! - f * du[i]!;
      if (i + 1 < n - 1) du[i + 1] = du[i + 1]! - f * du2[i]!;
      x[i + 1] = x[i + 1]! - f * x[i]!;
    } else {
      // swap rows i and i + 1
      const f = dm[i]! / dl[i + 1]!;
      const nm = dl[i + 1]!, nu = dm[i + 1]!, nu2 = i + 1 < n - 1 ? du[i + 1]! : 0;
      dm[i + 1] = du[i]! - f * nu;
      if (i + 1 < n - 1) du[i + 1] = -f * nu2;
      dm[i] = nm; du[i] = nu; du2[i] = nu2;
      const t = x[i]!; x[i] = x[i + 1]!; x[i + 1] = t - f * x[i + 1]!;
    }
  }
  if (dm[n - 1] === 0) dm[n - 1] = eps;
  x[n - 1] = x[n - 1]! / dm[n - 1]!;
  if (n >= 2) x[n - 2] = (x[n - 2]! - du[n - 2]! * x[n - 1]!) / (dm[n - 2] === 0 ? eps : dm[n - 2]!);
  for (let i = n - 3; i >= 0; i--) x[i] = (x[i]! - du[i]! * x[i + 1]! - du2[i]! * x[i + 2]!) / (dm[i] === 0 ? eps : dm[i]!);
  return x;
}
