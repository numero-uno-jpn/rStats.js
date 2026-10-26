// Probabilities of Dunnett's many-to-one statistics, computed exactly (to double precision) instead of by randomised
// multivariate integration.
//
// Written for rStats.js from the distribution's definition (no ported code). The statistics comparing groups
// i = 1..m with a control have, with lambda_i = n_i / (n_i + n_0), the representation
//   T_i = (sqrt(lambda_i) Z_0 + sqrt(1 - lambda_i) Z_i) / U
// with independent standard normals Z_0, Z_i and U = sqrt(chi^2_df / df) independent of them (U = 1 for df = Inf).
// Conditionally on Z_0 = z and U = u the T_i are independent, so
//   P(max T_i < c)   = E Prod_i Phi((sqrt(lambda_i) z + c u) / sqrt(1 - lambda_i))
//   P(max |T_i| < c) = E Prod_i [Phi((sqrt(lambda_i) z + c u) / sqrt(1 - lambda_i)) - Phi((sqrt(lambda_i) z - c u) / sqrt(1 - lambda_i))]
// The upper probabilities are integrated directly, as E [1 - Prod_i (1 - q_i)] with 1 - Prod computed as
// -expm1(sum log1p(-q_i)), so that small p-values keep their relative accuracy. The inner integral over z uses
// QUADPACK (src/integrate/quadpack.ts) on the whole line; the outer one is over v = log u, where the density of U
// times du is, with a = df / 2 and Stirling's error term stirlerr (Loader 2000),
//   2 sqrt(a / (2 pi)) exp(-stirlerr(a) - a (expm1(2 v) - 2 v)) dv,
// which keeps its relative accuracy for large df.

import { dqagie } from "../integrate/quadpack.js";
import { pnorm } from "../distributions/normal.js";
import { stirlerr } from "../special/loader.js";

const LOG_2PI = Math.log(2 * Math.PI);
const REL_TOL = 2e-14;
const LIMIT = 500;

function phi(z: number): number {
  return Math.exp(-0.5 * z * z - 0.5 * LOG_2PI);
}

/** log(Phi(x)) */
function logPhi(x: number): number {
  return pnorm(x, { logP: true });
}

/** Integral over the whole line with QUADPACK's dqagi at full precision */
function wholeLine(f: (x: number) => number, lower = -Infinity): number {
  const r = lower === -Infinity ? dqagie(f, 0, 2, 0, REL_TOL, LIMIT) : dqagie(f, lower, 1, 0, REL_TOL, LIMIT);
  return r.result;
}

/**
 * Inner probability given w = c u: P(max T_i >= c | U = u) (twoSided false) or P(max |T_i| >= c | U = u) (twoSided
 * true, w >= 0), integrated over Z_0.
 */
function conditionalUpper(w: number, lambda: readonly number[], twoSided: boolean): number {
  const sl = lambda.map(Math.sqrt);
  const s = lambda.map((l) => Math.sqrt(1 - l));
  const f = (z: number): number => {
    // log of the conditional probability that no statistic exceeds c
    let logIn = 0;
    for (let i = 0; i < sl.length; i++) {
      const a = (sl[i]! * z + w) / s[i]!;
      if (!twoSided) {
        logIn += logPhi(a);
        continue;
      }
      const b = (sl[i]! * z - w) / s[i]!;
      // probability outside (b, a): Phi(b) + (1 - Phi(a))
      const q = pnorm(b) + pnorm(a, { lowerTail: false });
      if (q < 0.5) logIn += Math.log1p(-q);
      else logIn += Math.log(a + b < 0 ? pnorm(a) - pnorm(b) : pnorm(b, { lowerTail: false }) - pnorm(a, { lowerTail: false }));
    }
    return phi(z) * -Math.expm1(logIn);
  };
  return wholeLine(f);
}

/**
 * Upper probability of Dunnett's statistics: P(max T_i >= c) (`twoSided` false) or P(max |T_i| >= c) (`twoSided`
 * true; c is then taken as |c|), with lambda_i = n_i / (n_i + n_0) and df degrees of freedom (Infinity: normal).
 */
export function pDunnettUpper(c: number, lambda: readonly number[], df: number, twoSided: boolean): number {
  if (Number.isNaN(c) || Number.isNaN(df)) return NaN;
  if (twoSided) c = Math.abs(c);
  if (c === Infinity) return 0;
  if (c === -Infinity) return 1;
  if (twoSided && c === 0) return 1;
  if (df === Infinity) return Math.min(1, conditionalUpper(c, lambda, twoSided));
  const a = df / 2;
  const logConst = Math.log(2) + 0.5 * Math.log(a) - 0.5 * LOG_2PI - stirlerr(a);
  const g = (v: number): number => {
    const ld = logConst - a * (Math.expm1(2 * v) - 2 * v);
    if (ld < -745) return 0;
    return Math.exp(ld) * conditionalUpper(c * Math.exp(v), lambda, twoSided);
  };
  return Math.min(1, wholeLine(g));
}
