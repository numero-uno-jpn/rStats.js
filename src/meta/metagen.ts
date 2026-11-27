// meta's metagen and the machinery shared by the meta functions: the common and random effects, Hartung-Knapp, the
// prediction interval, heterogeneity (Q, tau2 and its interval, H, I2 and their intervals). Written for rStats.js from
// the behaviour specification oracle/tsmeta-behaviour.md (Part 2) with the details found in
// experiments/tsmeta120-log.md (items 61-63). The generalised Q interval follows Jackson (2013), with the distribution of
// a weighted sum of chi-squares by Imhof's (1961) integral. No R or package source was read.

import { pchisq } from "../distributions/chisq.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { pt1, qt1 } from "../distributions/t.js";
import { confintRma, rma, type MetaMethod } from "../models/metaAnalysis.js";
import { integrate } from "../numerics/integrate.js";
import { symmetricEigen } from "../random/mvrnorm.js";
import { lgamma } from "../special/gamma.js";

/** The between-study variance estimators of meta (`method.tau`). */
export type MetaTauMethod = "REML" | "DL" | "PM" | "ML" | "SJ" | "HE" | "EB" | "HS";

/** Options shared by the meta functions. */
export interface MetaCommonOptions {
  /** The between-study variance estimator (default "REML"). */
  methodTau?: MetaTauMethod;
  /** "classic" (normal, default) or "HK" (Hartung-Knapp, t on k - 1). */
  methodRandomCi?: "classic" | "HK";
  /** The tau2 interval: "QP" (Q-profile), "J" (Jackson) or "BJ" (Biggerstaff-Jackson); default "J" for DL, else "QP". */
  methodTauCi?: "QP" | "J" | "BJ";
  /** Confidence level of the study and pooled intervals (default 0.95). */
  level?: number;
  /** Confidence level of the pooled intervals (default `level`). */
  levelMa?: number;
  /** Level of the prediction interval (default `level`). */
  levelPredict?: number;
}

/** The result of {@link metagen} (R's element names). */
export interface MetaResult {
  TE: number[]; seTE: number[]; k: number;
  "TE.common": number; "seTE.common": number; "lower.common": number; "upper.common": number; "statistic.common": number; "pval.common": number;
  "TE.random": number; "seTE.random": number; "lower.random": number; "upper.random": number; "statistic.random": number; "pval.random": number;
  /** Degrees of freedom of the random interval (k - 1 with Hartung-Knapp, else null). */
  "df.random": number | null;
  "seTE.predict": number; "lower.predict": number; "upper.predict": number; "df.predict": number;
  Q: number; "df.Q": number; "pval.Q": number;
  tau2: number; "lower.tau2": number; "upper.tau2": number; tau: number; "lower.tau": number; "upper.tau": number;
  H: number; "lower.H": number; "upper.H": number; I2: number; "lower.I2": number; "upper.I2": number;
  "w.common": number[]; "w.random": number[];
  methodTau: MetaTauMethod; methodRandomCi: "classic" | "HK"; methodTauCi: "QP" | "J" | "BJ";
}

const sum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);

/**
 * P(sum_j lambda_j chi2_1 <= q) for lambda_j >= 0: Ruben's (1962) series sum_k c_k P(chi2_{r + 2k} <= q / beta) with
 * beta = 2 lmin lmax / (lmin + lmax), or Imhof's (1961) integral when the series would be long.
 */
export function pWeightedChisq(q: number, lambda: readonly number[]): number {
  const mx = Math.max(0, ...lambda); const lam = lambda.filter((l) => l > 1e-14 * mx);
  if (lam.length === 0) return q >= 0 ? 1 : 0;
  if (q <= 0) return 0;
  const r = lam.length; const lmin = Math.min(...lam), lmax = Math.max(...lam);
  const beta = (2 * lmin * lmax) / (lmin + lmax); const rho = (lmax - lmin) / (lmax + lmin);
  const K = rho < 1e-12 ? 1 : Math.ceil(Math.log(1e-17) / Math.log(rho)) + 10;
  if (K <= 20000) {
    const x = q / beta; const gam = lam.map((l) => 1 - beta / l);
    const c: number[] = [Math.exp(0.5 * sum(lam.map((l) => Math.log(beta / l))))];
    const g: number[] = [0]; for (let m = 1; m <= K; m++) g.push(0.5 * sum(gam.map((gj) => gj ** m)));
    let F = pchisq(x, r) as number; // P(chi2_nu <= x), nu = r + 2k
    let lt = (r / 2) * Math.log(x / 2) - x / 2 - lgamma(r / 2 + 1); // log x^{nu/2} e^{-x/2} / (2^{nu/2} Gamma(nu/2 + 1))
    let total = c[0]! * F; let csum = c[0]!;
    for (let k = 1; k <= K; k++) {
      let ck = 0; for (let i = 0; i < k; i++) ck += g[k - i]! * c[i]!; ck /= k; c.push(ck);
      const nu = r + 2 * (k - 1); F -= Math.exp(lt); lt += Math.log(x / 2) - Math.log(nu / 2 + 1);
      total += ck * F; csum += ck;
      if (Math.abs(1 - csum) < 1e-16 && Math.abs(ck) < 1e-18) break;
    }
    return Math.min(1, Math.max(0, total));
  }
  const f = (u: number): number => {
    if (u === 0) return 0.5 * (sum(lam) - q);
    let th = 0, lr = 0;
    for (const l of lam) { th += Math.atan(l * u); lr += Math.log1p(l * l * u * u); }
    return Math.sin(0.5 * th - 0.5 * q * u) / (u * Math.exp(0.25 * lr));
  };
  const res = integrate(f, 0, Infinity, { relTol: 1e-10, subdivisions: 5000, stopOnError: false });
  return Math.min(1, Math.max(0, 0.5 - res.value / Math.PI));
}

/**
 * The generalised Q interval for tau2 (Jackson 2013) with study weights a: Q_a = sum a (y - mu_a)^2 follows
 * sum lambda chi2_1 with lambda the eigenvalues of S^(1/2) (A - a a' / sum a) S^(1/2), S = diag(v + tau2); the bounds
 * solve P(Q_a <= q_obs) = 1 - alpha/2 and alpha/2 (0 when not reached).
 */
export function genqInterval(y: readonly number[], v: readonly number[], a: readonly number[], level: number): [number, number] {
  const k = y.length; const sa = sum(a); const mu = sum(a.map((w, i) => w * y[i]!)) / sa;
  const qObs = sum(a.map((w, i) => w * (y[i]! - mu) ** 2));
  const cdf = (t2: number): number => {
    const s = v.map((vi) => Math.sqrt(vi + t2));
    const M = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => s[i]! * ((i === j ? a[i]! : 0) - (a[i]! * a[j]!) / sa) * s[j]!));
    return pWeightedChisq(qObs, symmetricEigen(M).values.map((l) => Math.max(0, l)));
  };
  const alpha = 1 - level;
  const solve = (target: number): number => {
    if (cdf(0) <= target) return 0;
    let hi = Math.max(1e-4, 1); while (cdf(hi) > target && hi < 1e12) hi *= 2;
    let lo = 0;
    for (let i = 0; i < 200 && hi - lo > 1e-15 * Math.max(1, hi); i++) { const mid = (lo + hi) / 2; if (cdf(mid) > target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  return [solve(1 - alpha / 2), solve(alpha / 2)];
}

/** The pooled estimates and heterogeneity of study estimates TE with standard errors seTE (inverse variance). */
/** Internal: a tau2 and a Q fixed by the caller (metabin's Q about the MH estimate with DL, log 64). */
export interface MetaCoreInternal { fixedTau2?: number; fixedQ?: number }

export function metaCore(TE: readonly number[], seTE: readonly number[], options: MetaCommonOptions & MetaCoreInternal = {}): MetaResult {
  const k = TE.length; const v = seTE.map((s) => s * s);
  const methodTau = options.methodTau ?? "REML"; const ciMethod = options.methodRandomCi ?? "classic";
  const methodTauCi = options.methodTauCi ?? (methodTau === "DL" ? "J" : "QP");
  const level = options.level ?? 0.95; const levelMa = options.levelMa ?? level; const levelPredict = options.levelPredict ?? level;
  const zMa = qnorm(0.5 + levelMa / 2) as number;
  const w = v.map((x) => 1 / x); const sw = sum(w);
  const teC = sum(w.map((wi, i) => wi * TE[i]!)) / sw; const seC = Math.sqrt(1 / sw);
  const Q = options.fixedQ ?? sum(w.map((wi, i) => wi * (TE[i]! - teC) ** 2)); const dfQ = k - 1;
  let tau2 = 0;
  if (options.fixedTau2 !== undefined) tau2 = options.fixedTau2;
  else if (k > 1) tau2 = rma(TE as number[], v, { method: methodTau as MetaMethod }).tau2;
  const wr = v.map((x) => 1 / (x + tau2)); const swr = sum(wr);
  const teR = sum(wr.map((wi, i) => wi * TE[i]!)) / swr;
  let seR = Math.sqrt(1 / swr); let lowR: number, upR: number, statR: number, pR: number, dfR: number | null = null;
  if (ciMethod === "HK" && k > 1) {
    const qhk = sum(wr.map((wi, i) => wi * (TE[i]! - teR) ** 2)) / (k - 1);
    seR = Math.sqrt(qhk / swr); dfR = k - 1;
    const tq = qt1(0.5 + levelMa / 2, dfR, true, false);
    lowR = teR - tq * seR; upR = teR + tq * seR; statR = teR / seR; pR = 2 * pt1(-Math.abs(statR), dfR, true, false);
  } else {
    lowR = teR - zMa * seR; upR = teR + zMa * seR; statR = teR / seR; pR = 2 * (pnorm(-Math.abs(statR)) as number);
  }
  const statC = teC / seC;
  // prediction interval ("V"): t(k - 1) with sqrt(tau2 + seTE.random^2)
  // (with the classic seTE.random also under Hartung-Knapp, log 96)
  const sePred = Math.sqrt(tau2 + 1 / swr); const dfPred = k - 1;
  const tp = dfPred > 0 ? qt1(0.5 + levelPredict / 2, dfPred, true, false) : NaN;
  // tau2 interval
  let lt = NaN, ut = NaN;
  if (k > 1) {
    if (methodTauCi === "QP") {
      const fit = rma(TE as number[], v, { method: methodTau as MetaMethod, level: 100 * level });
      const row = confintRma(fit, { type: "QP", level: 100 * level }).random.rows[0]!;
      // the whole interval at 0 when Q(0) is below the lower quantile (metafor's NA upper bound; meta reports 0)
      lt = row["ci.lb"]; ut = Number.isFinite(row["ci.ub"]) ? row["ci.ub"] : 0;
    } else {
      [lt, ut] = genqInterval(TE, v, methodTauCi === "J" ? seTE.map((s) => 1 / s) : w, level);
    }
  }
  // H and I2 (Higgins and Thompson 2002)
  // meta reports H at least 1 (Q below its degrees of freedom: H = 1)
  const H = k > 1 ? Math.max(1, Math.sqrt(Q / dfQ)) : NaN; const I2 = k > 1 ? Math.max(0, (Q - dfQ) / Q) : NaN;
  let lH = NaN, uH = NaN;
  if (k > 2) {
    const seLog = Q > k ? (0.5 * (Math.log(Q) - Math.log(dfQ))) / (Math.sqrt(2 * Q) - Math.sqrt(2 * k - 3)) : Math.sqrt((1 / (2 * (k - 2))) * (1 - 1 / (3 * (k - 2) ** 2)));
    const zl = qnorm(0.5 + level / 2) as number; const c = Math.log(Math.max(H, 1));
    lH = Math.max(1, Math.exp(c - zl * seLog)); uH = Math.max(1, Math.exp(c + zl * seLog));
  }
  return {
    TE: TE.slice(), seTE: seTE.slice(), k,
    "TE.common": teC, "seTE.common": seC, "lower.common": teC - zMa * seC, "upper.common": teC + zMa * seC, "statistic.common": statC, "pval.common": 2 * (pnorm(-Math.abs(statC)) as number),
    "TE.random": teR, "seTE.random": seR, "lower.random": lowR, "upper.random": upR, "statistic.random": statR, "pval.random": pR, "df.random": dfR,
    "seTE.predict": sePred, "lower.predict": teR - tp * sePred, "upper.predict": teR + tp * sePred, "df.predict": dfPred,
    Q, "df.Q": dfQ, "pval.Q": k > 1 ? (pchisq(Q, dfQ, { lowerTail: false }) as number) : NaN,
    tau2, "lower.tau2": lt, "upper.tau2": ut, tau: Math.sqrt(tau2), "lower.tau": Math.sqrt(lt), "upper.tau": Math.sqrt(ut),
    H, "lower.H": lH, "upper.H": uH, I2, "lower.I2": Math.max(0, 1 - 1 / (lH * lH)), "upper.I2": Math.max(0, 1 - 1 / (uH * uH)),
    "w.common": w, "w.random": wr, methodTau, methodRandomCi: ciMethod, methodTauCi,
  };
}

/**
 * Generic inverse-variance meta-analysis (meta's `metagen()`): study estimates TE with standard errors seTE; the
 * common effect, the random effect with tau2 by `methodTau` (default REML) and a classic or Hartung-Knapp interval,
 * the prediction interval (t on k - 1), Q, tau2's interval (QP, or J for DL), H and I2 with Higgins and Thompson's
 * intervals.
 *
 * @category Meta-analysis
 */
export function metagen(TE: readonly number[], seTE: readonly number[], options: MetaCommonOptions = {}): MetaResult {
  if (TE.length !== seTE.length) throw new RangeError("metagen: TE and seTE must have the same length");
  if (TE.length === 0) throw new RangeError("metagen: no studies");
  const ok = TE.map((t, i) => Number.isFinite(t) && Number.isFinite(seTE[i]!) && seTE[i]! > 0);
  if (ok.some((b) => !b)) throw new RangeError("metagen: TE must be finite and seTE finite and positive");
  return metaCore(TE, seTE, options);
}
