// Poisson random variates, and geometric and negative binomial variates built as gamma-Poisson mixtures.
//
// Ahrens & Dieter (1982) "Computer generation of Poisson deviates from modified normal
// distributions" (ACM TOMS 8(2)): algorithm PD. For mu < 10, table-based inversion (Case B in the paper);
// for mu >= 10, normal approximation with rejection (Case A). These are the algorithms cited in R's ?rpois,
// with the constants from the paper. The order in which uniforms are consumed and the parameter handling follow observed R output.

import { expRand, normRand, unifRand } from "./rng.js";
import { generate } from "./common.js";
import { rgamma1 } from "./gamma.js";

const A0 = -0.5, A1 = 0.3333333, A2 = -0.2500068, A3 = 0.2000118;
const A4 = -0.1661269, A5 = 0.1421878, A6 = -0.1384794, A7 = 0.125006;
const ONE_7 = 1 / 7, ONE_12 = 1 / 12, ONE_24 = 1 / 24;
const M_1_SQRT_2PI = 0.398942280401432677939946059934;
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

// Values rebuilt only when the parameters change (Case B's cumulative probability table and Case A's constants)
let l = 0, m = 0;
const pp = new Float64Array(36);
let muprev = 0, muprev2 = 0;
let pbase = 0, qbase = 0, p0 = 0; // p, q and p0 of Case B
let s = 0, d = 0, omega = 0, bigL = 0;
let b1 = 0, b2 = 0, c = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0;

/** One Poisson variate (mean mu) */
export function rpois1(mu: number): number {
  if (!Number.isFinite(mu) || mu < 0) return NaN;
  if (mu <= 0) return 0;

  const bigMu = mu >= 10;
  let newBigMu = false;

  if (!(bigMu && mu === muprev)) {
    if (bigMu) {
      newBigMu = true;
      muprev = mu;
      s = Math.sqrt(mu);
      d = 6 * mu * mu;
      bigL = Math.floor(mu - 1.1484);
    } else {
      // Case B: start a new table
      if (mu !== muprev) {
        muprev = mu;
        m = Math.max(1, Math.trunc(mu));
        l = 0;
        qbase = p0 = pbase = Math.exp(-mu);
      }
      for (;;) {
        // Step U: uniform for inversion
        const u = unifRand();
        if (u <= p0) return 0;
        // Step T: compare against the existing table
        if (l > 0) {
          const j = u > 0.458 ? Math.min(l, m) : 1;
          for (let k = j; k <= l; k++) if (u <= pp[k]!) return k;
          if (l === 35) continue;
        }
        // Step C: extend the table
        l++;
        for (let k = l; k <= 35; k++) {
          pbase *= mu / k;
          qbase += pbase;
          pp[k] = qbase;
          if (u <= qbase) {
            l = k;
            return k;
          }
        }
        l = 35;
      }
    }
  }

  // From here on mu >= 10. Step N: normal variate
  let pois = -1;
  let fk = 0, difmuk = 0, u = 0;
  const g = mu + s * normRand();
  if (g >= 0) {
    pois = Math.floor(g);
    // Step I: accept immediately if large enough
    if (pois >= bigL) return pois;
    // Step S: squeeze acceptance
    fk = pois;
    difmuk = mu - fk;
    u = unifRand();
    if (d * u >= difmuk * difmuk * difmuk) return pois;
  }
  // Step P: preparation for steps Q and H
  if (newBigMu || mu !== muprev2) {
    muprev2 = mu;
    omega = M_1_SQRT_2PI / s;
    b1 = ONE_24 / mu;
    b2 = 0.3 * b1 * b1;
    c3 = ONE_7 * b1 * b2;
    c2 = b2 - 15 * c3;
    c1 = b1 - 6 * b2 + 45 * c3;
    c0 = 1 - b1 + 3 * b2 - 15 * c3;
    c = 0.1069 / mu;
  }

  // Step F: compute px, py, fx, fy
  let px = 0, py = 0, fx = 0, fy = 0;
  const stepF = (): void => {
    if (pois < 10) {
      px = -mu;
      py = Math.pow(mu, pois) / FACT[pois]!;
    } else {
      let del = ONE_12 / fk;
      del = del * (1 - 4.8 * del * del);
      const v = difmuk / fk;
      if (Math.abs(v) <= 0.25) {
        px = fk * v * v * (((((((A7 * v + A6) * v + A5) * v + A4) * v + A3) * v + A2) * v + A1) * v + A0) - del;
      } else {
        px = fk * Math.log(1 + v) - difmuk - del;
      }
      py = M_1_SQRT_2PI / Math.sqrt(fk);
    }
    const x = (0.5 - difmuk) / s;
    const xx = x * x;
    fx = -0.5 * xx;
    fy = omega * (((c3 * xx + c2) * xx + c1) * xx + c0);
  };

  if (g >= 0) {
    stepF();
    // Step Q: quotient acceptance
    if (fy - u * fy <= py * Math.exp(px - fx)) return pois;
  }
  for (;;) {
    // Step E: generate t from the double exponential (always reject if t <= -0.6744)
    const e = expRand();
    u = 2 * unifRand() - 1;
    const t = 1.8 + (u >= 0 ? e : -e);
    if (t > -0.6744) {
      pois = Math.floor(mu + s * t);
      fk = pois;
      difmuk = mu - fk;
      stepF();
      // Step H: hat function acceptance
      if (c * Math.abs(u) <= py * Math.exp(px + e) - fy * Math.exp(fx + e)) break;
    }
  }
  return pois;
}

/**
 * Random numbers from the Poisson distribution. Equivalent to R's `rpois()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param lambda Mean.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export function rpois(n: number, lambda: number): number[] {
  return generate(n, () => rpois1(lambda));
}

/**
 * Random numbers from the geometric distribution (number of failures before the first
 * success). Equivalent to R's `rgeom()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param prob Probability of success in each trial, in (0, 1].
 * @returns An array of `n` values; `NaN` for invalid parameters.
 */
export function rgeom(n: number, prob: number): number[] {
  return generate(n, () => {
    if (!Number.isFinite(prob) || prob <= 0 || prob > 1) return NaN;
    return rpois1(expRand() * ((1 - prob) / prob));
  });
}

/**
 * Random numbers from the negative binomial distribution. Equivalent to R's `rnbinom()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param size Target number of successes (dispersion parameter; need not be an integer).
 * @param options.prob Probability of success in each trial. Give exactly one of `prob` and `mu`.
 * @param options.mu Mean (alternative parametrization). Give exactly one of `prob` and `mu`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 */
export function rnbinom(n: number, size: number, options: { prob?: number; mu?: number }): number[] {
  const { prob, mu } = options;
  if ((prob === undefined) === (mu === undefined)) throw new TypeError("specify exactly one of prob and mu");
  const sz = Number.isFinite(size) ? size : Number.MAX_VALUE / 2;
  if (mu !== undefined) {
    return generate(n, () => {
      if (!Number.isFinite(mu) || Number.isNaN(size) || size <= 0 || mu < 0) return NaN;
      return mu === 0 ? 0 : rpois1(rgamma1(sz, mu / sz));
    });
  }
  const p = prob!;
  return generate(n, () => {
    if (!Number.isFinite(p) || Number.isNaN(size) || size <= 0 || p <= 0 || p > 1) return NaN;
    return p === 1 ? 0 : rpois1(rgamma1(sz, (1 - p) / p));
  });
}
