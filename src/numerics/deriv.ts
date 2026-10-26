// Numerical derivatives: numDeriv's grad, jacobian and hessian (methods "Richardson" and "simple").
//
// Written for rStats.js from the textbook methods (no ported code); the defaults and the choice of steps follow
// numDeriv's documentation so the results agree with it. Richardson: central differences with steps h, h/2, ...,
// h/2^(r-1), h = d |x_i| (eps where |x_i| is below zeroTol), combined by Richardson extrapolation
// A <- (4^m A(h/2) - A(h)) / (4^m - 1) for m = 1, ..., r - 1. The Hessian is that of Bates and Watts (1988): the
// diagonal from second central differences, the off-diagonal entries from differences along e_i + e_j less the
// diagonal terms, each extrapolated the same way (with d = 0.1). "simple" is the forward difference with step eps.
// numDeriv's "complex" (complex-step) method needs a function of a complex argument and is not offered.

/** Options for {@link grad}, {@link jacobian} and {@link hessian}. */
export interface DerivOptions {
  /** `"Richardson"` (default) or `"simple"` (forward difference; not for `hessian`). */
  method?: "Richardson" | "simple";
  /** Step for "simple", and for coordinates near 0 in "Richardson". Default `1e-4`. */
  eps?: number;
  /** Relative initial step of "Richardson". Default `1e-4` (`0.1` for `hessian`). */
  d?: number;
  /** Coordinates with |x| below this get the step `eps`. Default `sqrt(2.220446e-16 / 7e-7)`. */
  zeroTol?: number;
  /** Number of halvings of the step (Richardson iterations). Default `4`. */
  r?: number;
}

interface Steps {
  eps: number;
  r: number;
  h0: number[];
}

function steps(x: readonly number[], options: DerivOptions, d0: number): Steps {
  const eps = options.eps ?? 1e-4;
  const d = options.d ?? d0;
  const zeroTol = options.zeroTol ?? Math.sqrt(Number.EPSILON / 7e-7);
  const r = options.r ?? 4;
  if (!(Number.isInteger(r) && r >= 1)) throw new RangeError("'r' must be a positive integer");
  return { eps, r, h0: x.map((v) => Math.abs(d * v) + (Math.abs(v) < zeroTol ? eps : 0)) };
}

/** Richardson extrapolation of approximations at steps h, h/2, h/4, ... (errors in even powers of h) */
function extrapolate(a: number[]): number {
  const t = [...a];
  for (let m = 1; m < t.length; m++) {
    const p = 4 ** m;
    for (let k = 0; k < t.length - m; k++) t[k] = (t[k + 1]! * p - t[k]!) / (p - 1);
  }
  return t[0]!;
}

function shifted(x: readonly number[], i: number, h: number): number[] {
  const y = [...x];
  y[i] = y[i]! + h;
  return y;
}

function method(options: DerivOptions): "Richardson" | "simple" {
  const m = options.method ?? "Richardson";
  if (m !== "Richardson" && m !== "simple") throw new RangeError(`unknown method "${String(m)}" (expected "Richardson" or "simple")`);
  return m;
}

/**
 * Gradient of a scalar function of a vector. Equivalent to `numDeriv::grad(func, x, method)` in R.
 *
 * @example
 * ```ts
 * grad((x) => x[0]! ** 2 + Math.sin(x[1]!), [1, 0]); // [2, 1]
 * ```
 */
export function grad(func: (x: number[]) => number, x: readonly number[], options: DerivOptions = {}): number[] {
  const xs = [...x];
  const n = xs.length;
  if (method(options) === "simple") {
    const eps = options.eps ?? 1e-4;
    const f0 = func([...xs]);
    return xs.map((_, i) => (func(shifted(xs, i, eps)) - f0) / eps);
  }
  const { r, h0 } = steps(xs, options, 1e-4);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a: number[] = [];
    let h = h0[i]!;
    for (let k = 0; k < r; k++) {
      // a central difference below 1e-20 is taken as 0 at the smaller steps (functions unstable near 0), as numDeriv does
      if (k > 0 && Math.abs(a[k - 1]!) < 1e-20) a.push(0);
      else a.push((func(shifted(xs, i, h)) - func(shifted(xs, i, -h))) / (2 * h));
      if (Number.isNaN(a[k]!)) throw new RangeError(`func returned NaN at step ${h} from x`);
      h /= 2;
    }
    out.push(extrapolate(a));
  }
  return out;
}

/**
 * Jacobian of a vector function of a vector: row i holds the derivatives of the i-th value. Equivalent to
 * `numDeriv::jacobian(func, x, method)` in R.
 *
 * @example
 * ```ts
 * jacobian((x) => [x[0]! * x[1]!, x[0]! + 2 * x[1]!], [2, 3]); // [[3, 2], [1, 2]]
 * ```
 */
export function jacobian(func: (x: number[]) => readonly number[], x: readonly number[], options: DerivOptions = {}): number[][] {
  const xs = [...x];
  const n = xs.length;
  const f0 = Array.from(func([...xs]));
  const J = f0.map(() => new Array<number>(n).fill(NaN));
  if (method(options) === "simple") {
    const eps = options.eps ?? 1e-4;
    for (let j = 0; j < n; j++) {
      const f1 = func(shifted(xs, j, eps));
      f0.forEach((v, i) => (J[i]![j] = (f1[i]! - v) / eps));
    }
    return J;
  }
  const { r, h0 } = steps(xs, options, 1e-4);
  for (let j = 0; j < n; j++) {
    const a: number[][] = f0.map(() => []);
    let h = h0[j]!;
    for (let k = 0; k < r; k++) {
      const fp = func(shifted(xs, j, h));
      const fm = func(shifted(xs, j, -h));
      f0.forEach((_, i) => a[i]!.push((fp[i]! - fm[i]!) / (2 * h)));
      h /= 2;
    }
    f0.forEach((_, i) => (J[i]![j] = extrapolate(a[i]!)));
  }
  return J;
}

/**
 * Hessian matrix of a scalar function of a vector, by Richardson extrapolation (Bates and Watts). Equivalent to
 * `numDeriv::hessian(func, x)` in R.
 *
 * @example
 * ```ts
 * hessian((x) => x[0]! ** 2 * x[1]! ** 2, [1, 2]); // [[8, 8], [8, 2]]
 * ```
 */
export function hessian(func: (x: number[]) => number, x: readonly number[], options: DerivOptions = {}): number[][] {
  if ((options.method ?? "Richardson") !== "Richardson") throw new RangeError('hessian supports only method "Richardson"');
  const xs = [...x];
  const n = xs.length;
  const { r, h0 } = steps(xs, options, 0.1);
  const f0 = func([...xs]);
  const diag: number[] = [];
  for (let i = 0; i < n; i++) {
    const a: number[] = [];
    let h = h0[i]!;
    for (let k = 0; k < r; k++) {
      a.push((func(shifted(xs, i, h)) - 2 * f0 + func(shifted(xs, i, -h))) / h ** 2);
      h /= 2;
    }
    diag.push(extrapolate(a));
  }
  const H = xs.map(() => new Array<number>(n).fill(NaN));
  for (let i = 0; i < n; i++) {
    H[i]![i] = diag[i]!;
    for (let j = 0; j < i; j++) {
      const a: number[] = [];
      let hi = h0[i]!;
      let hj = h0[j]!;
      for (let k = 0; k < r; k++) {
        const up = shifted(shifted(xs, i, hi), j, hj);
        const down = shifted(shifted(xs, i, -hi), j, -hj);
        a.push((func(up) - 2 * f0 + func(down) - diag[i]! * hi ** 2 - diag[j]! * hj ** 2) / (2 * hi * hj));
        hi /= 2;
        hj /= 2;
      }
      H[i]![j] = H[j]![i] = extrapolate(a);
    }
  }
  return H;
}
