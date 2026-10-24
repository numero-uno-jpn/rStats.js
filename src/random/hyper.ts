// Hypergeometric random variates.
//
// Kachitvichyanukul & Schmeiser (1985) "Computer generation of hypergeometric random
// variates" (J. Statist. Comput. Simul. 22): algorithm HIN (inversion when the mode is near the lower end) and
// H2PE (rejection over three regions). These are the algorithms cited in R's ?rhyper, with the constants from the paper.
// The order in which uniforms are consumed and the parameter handling follow observed R output.

import { unifRand } from "./rng.js";
import { generate } from "./common.js";
import { rbinom1 } from "./binomial.js";
import { qhyper1 } from "../distributions/hypergeometric.js";

const INT_MAX = 2147483647;
const LN_SQRT_2PI = 0.918938533204672741780329736406;
const DELTAL = 0.0078;
const DELTAU = 0.0034;
/** Scale factor (1e25) applied so probabilities do not collapse to 0 early during inversion, and its log */
const SCALE = 1e25;
const LOG_SCALE = 57.5646273248511421;

/** Table of log(i!) (i = 0..7) */
const LOG_FACT = [
  0, 0, 0.69314718055994530941723212145817, 1.7917594692280550008124773583807,
  3.17805383034794561964694160129705, 4.78749174278204599424770093452324,
  6.57925121201010099506017829290394, 8.52516136106541430016553103634712,
];

/** log(i!). For 8 and above, approximated by the Stirling series (2 terms) */
function afc(i: number): number {
  if (i < 0) return 0;
  if (i <= 7) return LOG_FACT[i]!;
  const di = i;
  const i2 = di * di;
  return (di + 0.5) * Math.log(di) - di + LN_SQRT_2PI + (0.0833333333333333 - 0.00277777777777778 / i2) / di;
}

// Values rebuilt only when the parameters change
let ks = -1, n1s = -1, n2s = -1;
let m = 0, minjx = 0, maxjx = 0;
let k = 0, n1 = 0, n2 = 0;
let N = 0, w = 0;
let a = 0, d = 0, xl = 0, xr = 0, kl = 0, kr = 0, lamdl = 0, lamdr = 0, p1 = 0, p2 = 0, p3 = 0;

/** One hypergeometric variate (kkin draws from nn1in white and nn2in black balls) */
export function rhyper1(nn1in: number, nn2in: number, kkin: number): number {
  if (!Number.isFinite(nn1in) || !Number.isFinite(nn2in) || !Number.isFinite(kkin)) return NaN;
  nn1in = Math.round(nn1in);
  nn2in = Math.round(nn2in);
  kkin = Math.round(kkin);
  if (nn1in < 0 || nn2in < 0 || kkin < 0 || kkin > nn1in + nn2in) return NaN;
  if (nn1in >= INT_MAX || nn2in >= INT_MAX || kkin >= INT_MAX) {
    // Parameters beyond the integer range: Bernoulli for a single draw, otherwise invert via the quantile function
    if (kkin === 1) return rbinom1(kkin, nn1in / (nn1in + nn2in));
    return qhyper1(unifRand(), nn1in, nn2in, kkin, false, false);
  }
  const nn1 = nn1in;
  const nn2 = nn2in;
  const kk = kkin;

  // Rebuild when the parameters change (everything if n1 or n2 changes; only the k-dependent parts if only k changes)
  let setup1: boolean, setup2: boolean;
  if (nn1 !== n1s || nn2 !== n2s) {
    setup1 = true;
    setup2 = true;
  } else if (kk !== ks) {
    setup1 = false;
    setup2 = true;
  } else {
    setup1 = false;
    setup2 = false;
  }
  if (setup1) {
    n1s = nn1;
    n2s = nn2;
    N = nn1 + nn2;
    if (nn1 <= nn2) {
      n1 = nn1;
      n2 = nn2;
    } else {
      n1 = nn2;
      n2 = nn1;
    }
  }
  if (setup2) {
    ks = kk;
    // If more than half are drawn, count the ones left instead
    k = kk + kk >= N ? Math.trunc(N - kk) : kk;
  }
  if (setup1 || setup2) {
    m = Math.trunc(((k + 1) * (n1 + 1)) / (N + 2));
    minjx = Math.max(0, k - n2);
    maxjx = Math.min(n1, k);
  }

  let ix: number;
  if (minjx === maxjx) {
    ix = maxjx;
  } else if (m - minjx < 10) {
    // Algorithm HIN: inversion, summing probabilities upward from the lower end
    if (setup1 || setup2) {
      let lw: number;
      if (k < n2) lw = afc(n2) + afc(n1 + n2 - k) - afc(n2 - k) - afc(n1 + n2);
      else lw = afc(n1) + afc(k) - afc(k - n2) - afc(n1 + n2);
      w = Math.exp(lw + LOG_SCALE);
    }
    outer: for (;;) {
      ix = minjx;
      let u = unifRand() * SCALE;
      let p = w;
      while (u > p) {
        u -= p;
        p *= (n1 - ix) * (k - ix);
        ix++;
        p = p / ix / (n2 - k + ix);
        if (ix > maxjx) continue outer;
      }
      break;
    }
  } else {
    // Algorithm H2PE
    if (setup1 || setup2) {
      const s = Math.sqrt(((N - k) * k * n1 * n2) / (N - 1) / N / N);
      d = Math.trunc(1.5 * s) + 0.5;
      xl = m - d + 0.5;
      xr = m + d + 0.5;
      a = afc(m) + afc(n1 - m) + afc(k - m) + afc(n2 - k + m);
      kl = Math.exp(a - afc(Math.trunc(xl)) - afc(Math.trunc(n1 - xl)) - afc(Math.trunc(k - xl)) - afc(Math.trunc(n2 - k + xl)));
      kr = Math.exp(
        a - afc(Math.trunc(xr - 1)) - afc(Math.trunc(n1 - xr + 1)) - afc(Math.trunc(k - xr + 1)) - afc(Math.trunc(n2 - k + xr - 1)),
      );
      lamdl = -Math.log((xl * (n2 - k + xl)) / (n1 - xl + 1) / (k - xl + 1));
      lamdr = -Math.log(((n1 - xr + 1) * (k - xr + 1)) / xr / (n2 - k + xr));
      p1 = d + d;
      p2 = p1 + kl / lamdl;
      p3 = p2 + kr / lamdr;
    }
    let tries = 0;
    for (;;) {
      const u = unifRand() * p3;
      let v = unifRand();
      if (++tries >= 10000) return NaN;
      if (u < p1) {
        // Central rectangle
        ix = Math.trunc(xl + u);
      } else if (u <= p2) {
        // Left tail (exponential)
        ix = Math.trunc(xl + Math.log(v) / lamdl);
        if (ix < minjx) continue;
        v = v * (u - p1) * lamdl;
      } else {
        // Right tail
        ix = Math.trunc(xr - Math.log(v) / lamdr);
        if (ix > maxjx) continue;
        v = v * (u - p2) * lamdr;
      }
      if (accept(ix, v)) break;
    }
  }

  // Undo the swap of white and black and the counting of the ones left
  if (kk + kk >= N) {
    ix = nn1 > nn2 ? kk - nn2 + ix : nn1 - ix;
  } else if (nn1 > nn2) {
    ix = kk - ix;
  }
  return ix;
}

/** Acceptance test of H2PE (compare the probability ratio f(ix)/f(m) with v) */
function accept(ix: number, v: number): boolean {
  if (m < 100 || ix <= 50) {
    // Compute the probability ratio directly by recurrence
    let f = 1;
    if (m < ix) {
      for (let i = m + 1; i <= ix; i++) f = (f * (n1 - i + 1) * (k - i + 1)) / (n2 - k + i) / i;
    } else if (m > ix) {
      for (let i = ix + 1; i <= m; i++) f = (f * i * (n2 - k + i)) / (n1 - i + 1) / (k - i + 1);
    }
    return v <= f;
  }
  // Squeeze using upper and lower bounds on log
  const y = ix;
  const y1 = y + 1;
  const ym = y - m;
  const yn = n1 - y + 1;
  const yk = k - y + 1;
  const nk = n2 - k + y1;
  const r = -ym / y1;
  const s = ym / yn;
  const t = ym / yk;
  const e = -ym / nk;
  const g = (yn * yk) / (y1 * nk) - 1;
  const dg = g < 0 ? 1 + g : 1;
  const gu = g * (1 + g * (-0.5 + g / 3));
  const gl = gu - (0.25 * (g * g * g * g)) / dg;
  const xm = m + 0.5;
  const xn = n1 - m + 0.5;
  const xk = k - m + 0.5;
  const nm = n2 - k + xm;
  const cubic = (z: number): number => z * (1 + z * (-0.5 + z / 3));
  const ub = y * gu - m * gl + DELTAU + xm * cubic(r) + xn * cubic(s) + xk * cubic(t) + nm * cubic(e);
  const alv = Math.log(v);
  if (alv > ub) return false;
  const quartic = (c: number, z: number): number => {
    const q = c * (z * z * z * z);
    return z < 0 ? q / (1 + z) : q;
  };
  const dr = quartic(xm, r);
  const ds = quartic(xn, s);
  const dt = quartic(xk, t);
  const de = quartic(nm, e);
  if (alv < ub - 0.25 * (dr + ds + dt + de) + (y + m) * (gl - gu) - DELTAL) return true;
  // Final test using Stirling's formula
  return alv <= a - afc(ix) - afc(n1 - ix) - afc(k - ix) - afc(n2 - k + ix);
}

/**
 * Random numbers from the hypergeometric distribution. Equivalent to R's `rhyper()`.
 *
 * @param nn Number of values to generate.
 * @param m Number of white balls in the urn.
 * @param n Number of black balls in the urn.
 * @param k Number of balls drawn from the urn.
 * @returns An array of `nn` values (the number of white balls drawn); `NaN` for invalid parameters.
 */
export function rhyper(nn: number, m: number, n: number, k: number): number[] {
  return generate(nn, () => rhyper1(m, n, k));
}
