// Binomial and multinomial random variates.
//
// Kachitvichyanukul & Schmeiser (1988) "Binomial random variate generation"
// (Comm. ACM 31(2)): algorithm BTPE. When n min(p, 1-p) < 30, inversion (BINV in the paper) is used.
// These are the algorithms cited in R's ?rbinom, with the constants from the paper. The order in which uniforms
// are consumed and the parameter handling follow observed R output.

import { unifRand } from "./rng.js";
import { generate, powInt } from "./common.js";
import { qbinom } from "../distributions/binomial.js";

const INT_MAX = 2147483647;

// Values rebuilt only when the parameters change
let c = 0, fm = 0, npq = 0, p1 = 0, p2 = 0, p3 = 0, p4 = 0, qn = 0;
let xl = 0, xll = 0, xlr = 0, xm = 0, xr = 0;
let psave = -1, nsave = -1, m = 0;

/** Correction term of Stirling's formula (13860 - (462 - (132 - (99 - 140/z²)/z²)/z²)/z²)/z/166320 */
function stirlingTail(z: number): number {
  const z2 = z * z;
  return (13860 - (462 - (132 - (99 - 140 / z2) / z2) / z2) / z2) / z / 166320;
}

/** One binomial variate (nin trials, success probability pp) */
export function rbinom1(nin: number, pp: number): number {
  if (!Number.isFinite(nin)) return NaN;
  const rn = Math.round(nin);
  if (rn !== nin) return NaN;
  if (!Number.isFinite(pp) || rn < 0 || pp < 0 || pp > 1) return NaN;
  if (rn === 0 || pp === 0) return 0;
  if (pp === 1) return rn;
  if (rn >= INT_MAX) return qbinom(unifRand(), rn, pp, { lowerTail: false });

  const n = rn;
  const p = Math.min(pp, 1 - pp);
  const q = 1 - p;
  const np = n * p;
  const r = p / q;
  const g = r * (n + 1);

  let small: boolean;
  if (pp !== psave || n !== nsave) {
    psave = pp;
    nsave = n;
    if (np < 30) {
      qn = powInt(q, n);
      small = true;
    } else {
      small = false;
      fm = np + p;
      m = Math.trunc(fm);
      npq = np * q;
      p1 = Math.trunc(2.195 * Math.sqrt(npq) - 4.6 * q) + 0.5;
      xm = m + 0.5;
      xl = xm - p1;
      xr = xm + p1;
      c = 0.134 + 20.5 / (15.3 + m);
      let al = (fm - xl) / (fm - xl * p);
      xll = al * (1 + 0.5 * al);
      al = (xr - fm) / (xr * q);
      xlr = al * (1 + 0.5 * al);
      p2 = p1 * (1 + c + c);
      p3 = p2 + c / xll;
      p4 = p3 + c / xlr;
    }
  } else {
    small = np < 30;
  }

  let ix: number;
  if (small) {
    // Inversion (mean below 30)
    outer: for (;;) {
      ix = 0;
      let f = qn;
      let u = unifRand();
      for (;;) {
        if (u < f) break outer;
        if (ix > 110) break;
        u -= f;
        ix++;
        f *= g / ix - r;
      }
    }
  } else {
    for (;;) {
      const u = unifRand() * p4;
      let v = unifRand();
      // Triangular region
      if (u <= p1) {
        ix = Math.trunc(xm - p1 * v + u);
        break;
      }
      if (u <= p2) {
        // Parallelogram region
        const x = xl + (u - p1) / c;
        v = v * c + 1 - Math.abs(xm - x) / p1;
        if (v > 1 || v <= 0) continue;
        ix = Math.trunc(x);
      } else if (u > p3) {
        // Right tail
        ix = Math.trunc(xr - Math.log(v) / xlr);
        if (ix > n) continue;
        v = v * (u - p3) * xlr;
      } else {
        // Left tail
        ix = Math.trunc(xl + Math.log(v) / xll);
        if (ix < 0) continue;
        v = v * (u - p2) * xll;
      }
      // Acceptance/rejection test
      const k = Math.abs(ix - m);
      if (k <= 20 || k >= npq / 2 - 1) {
        // Compute the probability ratio directly
        let f = 1;
        if (m < ix) {
          for (let i = m + 1; i <= ix; i++) f *= g / i - r;
        } else if (m > ix) {
          for (let i = ix + 1; i <= m; i++) f /= g / i - r;
        }
        if (v <= f) break;
      } else {
        // Squeeze using upper and lower bounds on log f
        const amaxp = (k / npq) * ((k * (k / 3 + 0.625) + 0.1666666666666) / npq + 0.5);
        const ynorm = (-k * k) / (2 * npq);
        const alv = Math.log(v);
        if (alv < ynorm - amaxp) break;
        if (alv <= ynorm + amaxp) {
          // Final test using Stirling's formula (M is the integer mode m)
          const x1 = ix + 1;
          const f1 = m + 1;
          const z = n + 1 - m;
          const w = n - ix + 1;
          if (
            alv <=
            xm * Math.log(f1 / x1) +
              (n - m + 0.5) * Math.log(z / w) +
              (ix - m) * Math.log((w * p) / (x1 * q)) +
              stirlingTail(f1) +
              stirlingTail(z) +
              stirlingTail(x1) +
              stirlingTail(w)
          ) {
            break;
          }
        }
      }
    }
  }
  if (psave > 0.5) ix = n - ix;
  return ix;
}

/**
 * Random numbers from the binomial distribution. Equivalent to R's `rbinom()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Number of trials.
 * @param prob Probability of success in each trial.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export function rbinom(n: number, size: number, prob: number): number[] {
  return generate(n, () => rbinom1(size, prob));
}

/**
 * Random vectors from the multinomial distribution. Equivalent to R's `rmultinom()`.
 *
 * Unlike R, which returns a K x n matrix with one draw per column, this returns `n` rows
 * with one draw per row (the transpose of R's result). The random stream is the same as R's.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Number of objects distributed into the K categories in each draw.
 * @param prob Category weights of length K. They need not sum to 1 (they are divided by their sum).
 * @returns An array of `n` arrays, each of length K and summing to `size`.
 * @throws RangeError if `size` is not a non-negative integer, or `prob` has a negative or
 *   non-finite value, or no positive value.
 */
export function rmultinom(n: number, size: number, prob: readonly number[]): number[][] {
  if (!Number.isFinite(size) || size < 0 || Math.round(size) !== size) throw new RangeError("size must be a non-negative integer");
  let sum = 0;
  for (const v of prob) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError("prob must contain non-negative finite numbers");
    sum += v;
  }
  if (sum === 0) throw new RangeError("prob must contain at least one positive value");
  const pr = prob.map((v) => v / sum);
  const K = pr.length;
  const draw = (): number[] => {
    const out = new Array<number>(K).fill(0);
    let left = size;
    let pTot = 1;
    for (let k = 0; k < K - 1; k++) {
      if (pr[k]) {
        const pk = pr[k]! / pTot;
        out[k] = pk < 1 ? rbinom1(left, pk) : left;
        left -= out[k]!;
      }
      if (left <= 0) return out;
      pTot -= pr[k]!;
    }
    out[K - 1] = left;
    return out;
  };
  if (!Number.isFinite(n) || n < 0) throw new RangeError("n must be a non-negative finite number");
  return Array.from({ length: Math.trunc(n) }, draw);
}
