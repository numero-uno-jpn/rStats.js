// meta's metacont, metainc, metacor, metamean, metarate and metaprop (inverse variance). Written for rStats.js from the
// behaviour specification oracle/tsmeta-behaviour.md with the details found in experiments/tsmeta120-log.md (items
// 66-67, 69, 98). No R or package source was read.

import { pchisq } from "../distributions/chisq.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { qt1 } from "../distributions/t.js";
import { glm, glmSummary } from "../models/glm.js";
import { glmer } from "../models/glmer.js";
import { lgamma } from "../special/gamma.js";
import { heterogeneityIntervals, metaCore, type MetaCommonOptions, type MetaResult } from "./metagen.js";

const sum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);
const sameLength = (what: string, ...v: readonly (readonly number[])[]): number => {
  const k = v[0]!.length; if (v.some((x) => x.length !== k)) throw new RangeError(`${what}: the inputs must have the same length`);
  if (k === 0) throw new RangeError(`${what}: no studies`); return k;
};
/** The pooled result of study values (NaN values left out of the pooling, kept in TE / seTE). */
function pool(TE: number[], seTE: number[], options: MetaCommonOptions): MetaResult {
  const idx = TE.map((t, i) => (Number.isFinite(t) && Number.isFinite(seTE[i]!) && seTE[i]! > 0 ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) throw new RangeError("meta: no study with a finite estimate and standard error");
  const core = metaCore(idx.map((i) => TE[i]!), idx.map((i) => seTE[i]!), options);
  const spread = (v: readonly number[]): number[] => { const o = new Array<number>(TE.length).fill(0); idx.forEach((i, j) => { o[i] = v[j]!; }); return o; };
  return { ...core, TE, seTE, k: idx.length, "w.common": spread(core["w.common"]), "w.random": spread(core["w.random"]) };
}

/**
 * Meta-analysis of continuous outcomes (meta's `metacont()`): sm "MD" (default), "SMD" (Hedges' g with the exact J;
 * variance 1/n1 + 1/n2 + (1 - (N - 4) / ((N - 2) J^2)) g^2, log 69) or "ROM" (log ratio of means).
 *
 * @category Meta-analysis
 */
export function metacont(n1: readonly number[], m1: readonly number[], sd1: readonly number[], n2: readonly number[], m2: readonly number[], sd2: readonly number[], options: MetaCommonOptions & { sm?: "MD" | "SMD" | "ROM" } = {}): MetaResult {
  const k = sameLength("metacont", n1, m1, sd1, n2, m2, sd2); const sm = options.sm ?? "MD";
  const TE: number[] = [], seTE: number[] = [];
  for (let i = 0; i < k; i++) {
    const a = n1[i]!, b = n2[i]!, s1 = sd1[i]!, s2 = sd2[i]!;
    if (sm === "MD") { TE.push(m1[i]! - m2[i]!); seTE.push(Math.sqrt((s1 * s1) / a + (s2 * s2) / b)); }
    else if (sm === "ROM") { TE.push(Math.log(m1[i]! / m2[i]!)); seTE.push(Math.sqrt((s1 * s1) / (a * m1[i]! ** 2) + (s2 * s2) / (b * m2[i]! ** 2))); }
    else {
      const N = a + b; const sp = Math.sqrt(((a - 1) * s1 * s1 + (b - 1) * s2 * s2) / (N - 2)); const df = N - 2;
      const J = Math.exp(lgamma(df / 2) - 0.5 * Math.log(df / 2) - lgamma((df - 1) / 2));
      const g = (J * (m1[i]! - m2[i]!)) / sp;
      TE.push(g); seTE.push(Math.sqrt(1 / a + 1 / b + (1 - (N - 4) / ((N - 2) * J * J)) * g * g));
    }
  }
  return pool(TE, seTE, options);
}

/**
 * Meta-analysis of incidence rates (meta's `metainc()`): events e1 / e2 in person-times t1 / t2; sm "IRR" (default) or
 * "IRD"; method "MH" (default; Greenland and Robins 1985, no increments) or "Inverse". Studies with a zero get 0.5 added
 * to the events for the study values (log 67).
 *
 * @category Meta-analysis
 */
export function metainc(e1: readonly number[], t1: readonly number[], e2: readonly number[], t2: readonly number[], options: MetaCommonOptions & { sm?: "IRR" | "IRD"; method?: "MH" | "Inverse"; incr?: number } = {}): MetaResult {
  const k = sameLength("metainc", e1, t1, e2, t2); const sm = options.sm ?? "IRR"; const method = options.method ?? "MH"; const incr = options.incr ?? 0.5;
  const TE: number[] = [], seTE: number[] = [];
  for (let i = 0; i < k; i++) {
    const z = e1[i] === 0 || e2[i] === 0 ? incr : 0; const x1 = e1[i]! + z, x2 = e2[i]! + z;
    if (sm === "IRR") { TE.push(Math.log(x1 / t1[i]! / (x2 / t2[i]!))); seTE.push(Math.sqrt(1 / x1 + 1 / x2)); }
    else { TE.push(e1[i]! / t1[i]! - e2[i]! / t2[i]!); seTE.push(Math.sqrt(x1 / t1[i]! ** 2 + x2 / t2[i]! ** 2)); }
  }
  const res = pool(TE, seTE, options);
  if (method === "MH") {
    const T = t1.map((x, i) => x + t2[i]!); let te: number, se: number, w: number[];
    if (sm === "IRR") {
      const R = e1.map((x, i) => (x * t2[i]!) / T[i]!), S = e2.map((x, i) => (x * t1[i]!) / T[i]!);
      te = Math.log(sum(R) / sum(S)); se = Math.sqrt(sum(T.map((tt, i) => (t1[i]! * t2[i]! * (e1[i]! + e2[i]!)) / (tt * tt))) / (sum(R) * sum(S))); w = S;
    } else {
      const W = t1.map((x, i) => (x * t2[i]!) / T[i]!);
      te = sum(e1.map((x, i) => (x * t2[i]! - e2[i]! * t1[i]!) / T[i]!)) / sum(W);
      se = Math.sqrt(sum(W.map((wi, i) => wi * wi * (e1[i]! / t1[i]! ** 2 + e2[i]! / t2[i]! ** 2))) / sum(W) ** 2); w = W;
    }
    const level = options.levelMa ?? options.level ?? 0.95; const zq = qnorm(0.5 + level / 2) as number; const st = te / se;
    Object.assign(res, { "TE.common": te, "seTE.common": se, "lower.common": te - zq * se, "upper.common": te + zq * se, "statistic.common": st, "pval.common": 2 * (pnorm(-Math.abs(st)) as number), "w.common": w });
  }
  return res;
}

/**
 * Meta-analysis of correlations (meta's `metacor()`): sm "ZCOR" (Fisher's z, variance 1/(n - 3), default) or "COR"
 * (variance (1 - r^2)^2 / (n - 1)).
 *
 * @category Meta-analysis
 */
export function metacor(cor: readonly number[], n: readonly number[], options: MetaCommonOptions & { sm?: "ZCOR" | "COR" } = {}): MetaResult {
  sameLength("metacor", cor, n); const sm = options.sm ?? "ZCOR";
  return pool(cor.map((r) => (sm === "ZCOR" ? Math.atanh(r) : r)), cor.map((r, i) => (sm === "ZCOR" ? 1 / Math.sqrt(n[i]! - 3) : (1 - r * r) / Math.sqrt(n[i]! - 1))), options);
}

/**
 * Meta-analysis of single means (meta's `metamean()`): sm "MRAW" (default; variance sd^2/n) or "MLN" (log mean,
 * variance sd^2 / (n mean^2)).
 *
 * @category Meta-analysis
 */
export function metamean(n: readonly number[], mean: readonly number[], sd: readonly number[], options: MetaCommonOptions & { sm?: "MRAW" | "MLN" } = {}): MetaResult {
  sameLength("metamean", n, mean, sd); const sm = options.sm ?? "MRAW";
  return pool(mean.map((m) => (sm === "MRAW" ? m : Math.log(m))), sd.map((s, i) => (sm === "MRAW" ? s / Math.sqrt(n[i]!) : s / (Math.sqrt(n[i]!) * mean[i]!))), options);
}

/**
 * Meta-analysis of single incidence rates (meta's `metarate()`): sm "IRLN" (log rate, default), "IR", "IRS" (square
 * root) or "IRFT" (Freeman-Tukey); 0.5 added to zero counts for IR and IRLN.
 *
 * @category Meta-analysis
 */
export function metarate(event: readonly number[], time: readonly number[], options: MetaCommonOptions & { sm?: "IRLN" | "IR" | "IRS" | "IRFT"; incr?: number } = {}): MetaResult {
  sameLength("metarate", event, time); const sm = options.sm ?? "IRLN"; const incr = options.incr ?? 0.5;
  const TE: number[] = [], seTE: number[] = [];
  event.forEach((e0, i) => {
    const t = time[i]!; const e = (sm === "IR" || sm === "IRLN") && e0 === 0 ? e0 + incr : e0;
    if (sm === "IRLN") { TE.push(Math.log(e / t)); seTE.push(Math.sqrt(1 / e)); }
    else if (sm === "IR") { TE.push(e / t); seTE.push(Math.sqrt(e) / t); }
    else if (sm === "IRS") { TE.push(Math.sqrt(e / t)); seTE.push(Math.sqrt(1 / (4 * t))); }
    else { TE.push(0.5 * (Math.sqrt(e / t) + Math.sqrt((e + 1) / t))); seTE.push(Math.sqrt(1 / (4 * t))); }
  });
  return pool(TE, seTE, options);
}

/**
 * Meta-analysis of single proportions by the inverse variance (meta's `metaprop(method = "Inverse")`): sm "PLOGIT"
 * (default; (x + 0.5)/(n + 1) for 0 or n events), "PFT" (Freeman-Tukey), "PAS" (arcsine), "PRAW" or "PLN"
 * (log((x + 0.5)/(n + 0.5)) for 0; for n events the variance 1/x - 1/(n + 0.5)). The default method of meta, the GLMM, is {@link metapropGlmm}.
 *
 * @category Meta-analysis
 */
export function metaprop(event: readonly number[], n: readonly number[], options: MetaCommonOptions & { sm?: "PLOGIT" | "PFT" | "PAS" | "PRAW" | "PLN"; incr?: number } = {}): MetaResult {
  sameLength("metaprop", event, n); const sm = options.sm ?? "PLOGIT"; const incr = options.incr ?? 0.5;
  const TE: number[] = [], seTE: number[] = [];
  event.forEach((x, i) => {
    const N = n[i]!; const edge = x === 0 || x === N;
    if (sm === "PLOGIT") { const a = edge ? x + incr : x, b = edge ? N - x + incr : N - x; TE.push(Math.log(a / b)); seTE.push(Math.sqrt(1 / a + 1 / b)); }
    else if (sm === "PFT") { TE.push(0.5 * (Math.asin(Math.sqrt(x / (N + 1))) + Math.asin(Math.sqrt((x + 1) / (N + 1))))); seTE.push(Math.sqrt(1 / (4 * N + 2))); }
    else if (sm === "PAS") { TE.push(Math.asin(Math.sqrt(x / N))); seTE.push(Math.sqrt(1 / (4 * N))); }
    else if (sm === "PRAW") {
      const a = edge ? x + incr : x, nn = edge ? N + 2 * incr : N; const p = a / nn;
      TE.push(x / N); seTE.push(Math.sqrt((p * (1 - p)) / nn));
    } else {
      // PLN: for 0 events log((x + 0.5)/(n + 0.5)); for n events the raw log(x/n) = 0 with the variance 1/x - 1/(n + 0.5)
      // (meta's values, log 98)
      const a = x === 0 ? x + incr : x, nn = edge ? N + incr : N; TE.push(Math.log(a / (x === 0 ? nn : N))); seTE.push(Math.sqrt(1 / a - 1 / nn));
    }
  });
  return pool(TE, seTE, options);
}

/** The result of {@link metapropGlmm}: as {@link MetaResult}, with Q, df.Q and pval.Q as [Wald, LRT]. */
export type MetapropGlmmResult = Omit<MetaResult, "Q" | "df.Q" | "pval.Q"> & { Q: [number, number]; "df.Q": [number, number]; "pval.Q": [number, number] };

/**
 * Meta-analysis of single proportions by a random intercept logistic model (meta's `metaprop()` default, method
 * "GLMM"; log 75-76): glmer(x/n ~ 1 + (1 | study), binomial, weights n, nAGQ = 7) for the random effect and tau2,
 * glm(x/n ~ 1) for the common effect; Q = [Wald, LRT]: the Wald test of equal study effects in glm(x/n ~ study) and the
 * common glm's deviance; H and I2 from the Wald Q. Study values are the PLOGIT ones.
 *
 * @category Meta-analysis
 */
export function metapropGlmm(event: readonly number[], n: readonly number[], options: Omit<MetaCommonOptions, "methodTau" | "methodTauCi"> = {}): MetapropGlmmResult {
  const k = sameLength("metapropGlmm", event, n);
  if (k < 2) throw new RangeError("metapropGlmm: at least two studies");
  const study = event.map((_, i) => `s${String(i + 1).padStart(String(k).length, "0")}`);
  const data = { p: event.map((x, i) => x / n[i]!), w: n.slice(), study };
  const fitR = glmer("p ~ 1 + (1 | study)", data, { family: "binomial", weights: "w", nAGQ: 7 });
  const tau2 = fitR.theta[0]! ** 2; const teR = fitR.fixef[0]!; const seR = Math.sqrt(fitR.vcov[0]![0]!);
  const fitC = glm("p ~ 1", data, { family: "binomial", weights: "w" }); const teC = fitC.coefficients[0]!; const seC = Math.sqrt(glmSummary(fitC).covUnscaled[0]![0]!);
  const fitS = glm("p ~ study", data, { family: "binomial", weights: "w" }); const V = glmSummary(fitS).covUnscaled;
  const d = fitS.coefficients.slice(1); const Vd = V.slice(1).map((r) => r.slice(1));
  const qWald = dot(d, solveSym(Vd, d)); const qLrt = fitC.deviance; const df = k - 1;
  const level = options.levelMa ?? options.level ?? 0.95; const z = qnorm(0.5 + level / 2) as number;
  const levelPredict = options.levelPredict ?? options.level ?? 0.95;
  const sePred = Math.sqrt(tau2 + seR * seR); const tp = qt1(0.5 + levelPredict / 2, df, true, false);
  const het = heterogeneityIntervals(qWald, k, options.level ?? 0.95);
  const plogit = metaprop(event, n, { sm: "PLOGIT" });
  const stC = teC / seC;
  return {
    TE: plogit.TE, seTE: plogit.seTE, k,
    "TE.common": teC, "seTE.common": seC, "lower.common": teC - z * seC, "upper.common": teC + z * seC, "statistic.common": stC, "pval.common": 2 * (pnorm(-Math.abs(stC)) as number),
    "TE.random": teR, "seTE.random": seR, "lower.random": teR - z * seR, "upper.random": teR + z * seR, "statistic.random": teR / seR, "pval.random": 2 * (pnorm(-Math.abs(teR / seR)) as number), "df.random": null,
    "seTE.predict": sePred, "lower.predict": teR - tp * sePred, "upper.predict": teR + tp * sePred, "df.predict": df,
    Q: [qWald, qLrt], "df.Q": [df, df], "pval.Q": [pchisq(qWald, df, { lowerTail: false }) as number, pchisq(qLrt, df, { lowerTail: false }) as number],
    tau2, "lower.tau2": NaN, "upper.tau2": NaN, tau: Math.sqrt(tau2), "lower.tau": NaN, "upper.tau": NaN,
    H: het.H, "lower.H": het.lH, "upper.H": het.uH, I2: het.I2, "lower.I2": het.lI2, "upper.I2": het.uI2,
    "w.common": new Array<number>(k).fill(NaN), "w.random": new Array<number>(k).fill(NaN),
    methodTau: "ML", methodRandomCi: options.methodRandomCi ?? "classic", methodTauCi: "QP",
  };
}

const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, x, i) => s + x * b[i]!, 0);
/** Solves A x = b for a symmetric positive definite A (Cholesky). */
function solveSym(A: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = b.length; const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i]![j]!; for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
    L[i]![j] = i === j ? Math.sqrt(s) : s / L[j]![j]!;
  }
  const y = new Array<number>(n); for (let i = 0; i < n; i++) { let s = b[i]!; for (let k = 0; k < i; k++) s -= L[i]![k]! * y[k]!; y[i] = s / L[i]![i]!; }
  const x = new Array<number>(n); for (let i = n - 1; i >= 0; i--) { let s = y[i]!; for (let k = i + 1; k < n; k++) s -= L[k]![i]! * x[k]!; x[i] = s / L[i]![i]!; }
  return x;
}
