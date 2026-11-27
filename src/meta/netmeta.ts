// netmeta's frequentist network meta-analysis: netmeta (common and random effects by graph theory), netrank
// (P-scores), netsplit, decomp.design, netmeasures' proportion, netconnection, pairwise, netcomb / discomb (additive
// component models), netleague and netposet. Written for rStats.js from the behaviour specification
// oracle/tsmeta-behaviour.md ("netmeta") with the details found in experiments/tsmeta120-log.md (items 71-74, 77, 101).
// The methods are those of Ruecker (2012), Jackson, White and Riley (2012), Ruecker and Schwarzer (2015) and Ruecker et
// al. (2020). No R or package source was read.

import { pchisq } from "../distributions/chisq.js";
import { pnorm, qnorm } from "../distributions/normal.js";
import { qt1 } from "../distributions/t.js";
import { symmetricEigen } from "../random/mvrnorm.js";
import { heterogeneityIntervals } from "./metagen.js";

type Mat = number[][];
const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0));
const mul = (A: Mat, B: Mat): Mat => A.map((row) => B[0]!.map((_, j) => row.reduce((s, a, k) => s + a * B[k]![j]!, 0)));
const tr = (A: Mat): Mat => A[0]!.map((_, j) => A.map((r) => r[j]!));
const sum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);
/** The Moore-Penrose pseudoinverse of a symmetric matrix (eigenvalues below 1e-10 of the largest dropped). */
function pinvSym(A: Mat): Mat {
  const n = A.length; const S = A.map((r, i) => r.map((v, j) => (v + A[j]![i]!) / 2)); const { values, vectors } = symmetricEigen(S);
  const mx = Math.max(...values.map(Math.abs)); const out = zeros(n, n);
  values.forEach((l, k) => { if (Math.abs(l) > 1e-10 * mx) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i]![j]! += (vectors[i]![k]! * vectors[j]![k]!) / l; });
  return out;
}

/** A matrix with treatment names. */
export interface TreatmentMatrix { rows: string[]; cols: string[]; values: number[][] }

/** The result of {@link netmeta} (R's element names). */
export interface NetmetaResult {
  trts: string[]; studlab: string[]; treat1: string[]; treat2: string[]; TE: number[]; seTE: number[];
  k: number; n: number; m: number;
  "TE.common": TreatmentMatrix; "seTE.common": TreatmentMatrix; "lower.common": TreatmentMatrix; "upper.common": TreatmentMatrix;
  "TE.random": TreatmentMatrix; "seTE.random": TreatmentMatrix; "lower.random": TreatmentMatrix; "upper.random": TreatmentMatrix;
  "lower.predict": TreatmentMatrix; "upper.predict": TreatmentMatrix;
  "TE.direct.common": TreatmentMatrix; "seTE.direct.common": TreatmentMatrix; "TE.direct.random": TreatmentMatrix; "seTE.direct.random": TreatmentMatrix;
  Q: number; "df.Q": number; "pval.Q": number; tau2: number; I2: number; "lower.I2": number; "upper.I2": number;
  "Q.heterogeneity": number; "df.Q.heterogeneity": number; "Q.inconsistency": number; "df.Q.inconsistency": number;
  "w.common": number[]; "w.random": number[];
  referenceGroup: string | null; level: number;
}

interface Fit { theta: number[]; Lp: Mat; Q: number; w: number[]; B: Mat }

/** The weights of the contrasts: 1/v for two-arm studies, -L_s[i, j] with L_s = pinv(-P V P / 2) for multi-arm ones. */
function contrastWeights(v: readonly number[], t1: readonly string[], t2: readonly string[], stud: readonly string[]): number[] {
  const w = new Array<number>(v.length).fill(0);
  for (const s of [...new Set(stud)]) {
    const idx = stud.map((x, i) => (x === s ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 1) { w[idx[0]!] = 1 / v[idx[0]!]!; continue; }
    const arms = [...new Set(idx.flatMap((i) => [t1[i]!, t2[i]!]))]; const k = arms.length;
    const V = zeros(k, k); for (const i of idx) { const a = arms.indexOf(t1[i]!), b = arms.indexOf(t2[i]!); V[a]![b] = v[i]!; V[b]![a] = v[i]!; }
    const P = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0) - 1 / k));
    const Ls = pinvSym(mul(mul(P, V), P).map((r) => r.map((x) => -x / 2)));
    for (const i of idx) w[i] = -Ls[arms.indexOf(t1[i]!)]![arms.indexOf(t2[i]!)]!;
  }
  return w;
}

function fitNetwork(TE: readonly number[], v: readonly number[], t1: readonly string[], t2: readonly string[], stud: readonly string[], trts: readonly string[]): Fit {
  const m = TE.length, n = trts.length; const B = zeros(m, n);
  for (let i = 0; i < m; i++) { B[i]![trts.indexOf(t1[i]!)] = 1; B[i]![trts.indexOf(t2[i]!)] = -1; }
  const w = contrastWeights(v, t1, t2, stud);
  const L = zeros(n, n); for (let i = 0; i < m; i++) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) L[a]![b]! += B[i]![a]! * w[i]! * B[i]![b]!;
  const Lp = pinvSym(L);
  const BtWy = Array.from({ length: n }, (_, a) => sum(B.map((r, i) => r[a]! * w[i]! * TE[i]!)));
  const theta = Lp.map((r) => sum(r.map((x, b) => x * BtWy[b]!)));
  const Q = sum(TE.map((y, i) => w[i]! * (y - sum(B[i]!.map((x, a) => x * theta[a]!))) ** 2));
  return { theta, Lp, Q, w, B };
}

const matOf = (trts: readonly string[], f: (i: number, j: number) => number): TreatmentMatrix => ({ rows: [...trts], cols: [...trts], values: trts.map((_, i) => trts.map((__, j) => f(i, j))) });

/**
 * Frequentist network meta-analysis (netmeta's `netmeta()`): contrasts TE (treat1 versus treat2) with standard errors
 * seTE from studies studlab; the common effects by weighted least squares on the network graph (Ruecker 2012; multi-arm
 * studies by the effective resistances of their comparisons), Q on sum(arms - 1) - (n - 1) df, tau2 by the DL
 * generalisation of Jackson, White and Riley (2012), the random effects with seTE^2 + tau2, the direct estimates, the
 * prediction interval (t on df.Q), and Q split into heterogeneity (within designs) and inconsistency (between).
 *
 * @category Meta-analysis
 */
export function netmeta(TE: readonly number[], seTE: readonly number[], treat1: readonly string[], treat2: readonly string[], studlab: readonly string[], options: { referenceGroup?: string; level?: number; levelPredict?: number; tau2?: number } = {}): NetmetaResult {
  const m = TE.length;
  if (![seTE, treat1, treat2, studlab].every((x) => x.length === m)) throw new RangeError("netmeta: the inputs must have the same length");
  for (let i = 0; i < m; i++) {
    if (!(Number.isFinite(TE[i]!) && seTE[i]! > 0)) throw new RangeError("netmeta: TE must be finite and seTE positive");
    if (treat1[i] === treat2[i]) throw new RangeError("netmeta: treat1 and treat2 must differ");
  }
  const trts = [...new Set([...treat1, ...treat2])].sort(); const n = trts.length;
  if (netconnection(treat1, treat2, studlab)["n.subnets"] > 1) throw new RangeError("netmeta: the network is not connected (see netconnection)");
  const v = seTE.map((s) => s * s); const studies = [...new Set(studlab)]; const k = studies.length;
  const fitC = fitNetwork(TE, v, treat1, treat2, studlab, trts);
  const arms = studies.map((s) => new Set(studlab.flatMap((x, i) => (x === s ? [treat1[i]!, treat2[i]!] : []))).size);
  const dfQ = sum(arms.map((a) => a - 1)) - (n - 1);
  // tau2: (Q - df) / tr(W (I - H) S (I - H)'), H = B L+ B' W, S = (1/2) C C' per study
  let tau2 = options.tau2 ?? 0;
  if (options.tau2 === undefined && dfQ > 0) {
    const B = fitC.B; const W = fitC.w; const BL = mul(B, fitC.Lp); const H = mul(BL, tr(B)).map((r) => r.map((x, j) => x * W[j]!));
    const IH = H.map((r, i) => r.map((x, j) => (i === j ? 1 : 0) - x)); const S = zeros(m, m);
    for (const s of studies) { const idx = studlab.map((x, i) => (x === s ? i : -1)).filter((i) => i >= 0); for (const a of idx) for (const b of idx) S[a]![b] = 0.5 * sum(B[a]!.map((x, t) => x * B[b]![t]!)); }
    const M = mul(mul(IH, S), tr(IH)); const trace = sum(M.map((r, i) => W[i]! * r[i]!));
    tau2 = Math.max(0, (fitC.Q - dfQ) / trace);
  }
  const fitR = fitNetwork(TE, v.map((x) => x + tau2), treat1, treat2, studlab, trts);
  const level = options.level ?? 0.95; const z = qnorm(0.5 + level / 2) as number; const levelPredict = options.levelPredict ?? level;
  const te = (f: Fit) => (i: number, j: number): number => f.theta[i]! - f.theta[j]!;
  const se = (f: Fit) => (i: number, j: number): number => (i === j ? 0 : Math.sqrt(Math.max(0, f.Lp[i]![i]! + f.Lp[j]![j]! - 2 * f.Lp[i]![j]!)));
  const tp = dfQ > 0 ? qt1(0.5 + levelPredict / 2, dfQ, true, false) : NaN;
  const direct = (add: number): { te: TreatmentMatrix; se: TreatmentMatrix } => {
    const T = matOf(trts, () => NaN), S = matOf(trts, () => NaN);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rows = TE.map((_, r) => (treat1[r] === trts[i] && treat2[r] === trts[j] ? 1 : treat1[r] === trts[j] && treat2[r] === trts[i] ? -1 : 0));
      const w = rows.map((s, r) => (s === 0 ? 0 : 1 / (v[r]! + add))); const sw = sum(w);
      if (sw > 0) { T.values[i]![j] = sum(w.map((wr, r) => wr * rows[r]! * TE[r]!)) / sw; S.values[i]![j] = Math.sqrt(1 / sw); }
    }
    return { te: T, se: S };
  };
  const dC = direct(0), dR = direct(tau2);
  // heterogeneity within designs and inconsistency between them
  const design = (s: string): string => [...new Set(studlab.flatMap((x, i) => (x === s ? [treat1[i]!, treat2[i]!] : [])))].sort().join(":");
  let qHet = 0, dfHet = 0;
  for (const g of [...new Set(studies.map(design))]) {
    const rows = studlab.map((x, i) => (design(x) === g ? i : -1)).filter((i) => i >= 0);
    const ts = [...new Set(rows.flatMap((i) => [treat1[i]!, treat2[i]!]))].sort();
    const f = fitNetwork(rows.map((i) => TE[i]!), rows.map((i) => v[i]!), rows.map((i) => treat1[i]!), rows.map((i) => treat2[i]!), rows.map((i) => studlab[i]!), ts);
    const ks = new Set(rows.map((i) => studlab[i]!)).size; qHet += f.Q; dfHet += (ks - 1) * (ts.length - 1);
  }
  const het = heterogeneityIntervals(fitC.Q, dfQ + 1, level);
  const tC = te(fitC), sC = se(fitC), tR = te(fitR), sR = se(fitR);
  return {
    trts, studlab: [...studlab], treat1: [...treat1], treat2: [...treat2], TE: [...TE], seTE: [...seTE], k, n, m,
    "TE.common": matOf(trts, tC), "seTE.common": matOf(trts, sC), "lower.common": matOf(trts, (i, j) => tC(i, j) - z * sC(i, j)), "upper.common": matOf(trts, (i, j) => tC(i, j) + z * sC(i, j)),
    "TE.random": matOf(trts, tR), "seTE.random": matOf(trts, sR), "lower.random": matOf(trts, (i, j) => tR(i, j) - z * sR(i, j)), "upper.random": matOf(trts, (i, j) => tR(i, j) + z * sR(i, j)),
    "lower.predict": matOf(trts, (i, j) => (i === j ? 0 : tR(i, j) - tp * Math.sqrt(sR(i, j) ** 2 + tau2))), "upper.predict": matOf(trts, (i, j) => (i === j ? 0 : tR(i, j) + tp * Math.sqrt(sR(i, j) ** 2 + tau2))),
    "TE.direct.common": dC.te, "seTE.direct.common": dC.se, "TE.direct.random": dR.te, "seTE.direct.random": dR.se,
    Q: fitC.Q, "df.Q": dfQ, "pval.Q": dfQ > 0 ? (pchisq(fitC.Q, dfQ, { lowerTail: false }) as number) : NaN, tau2,
    I2: het.I2, "lower.I2": het.lI2, "upper.I2": het.uI2,
    "Q.heterogeneity": qHet, "df.Q.heterogeneity": dfHet, "Q.inconsistency": fitC.Q - qHet, "df.Q.inconsistency": dfQ - dfHet,
    "w.common": fitC.w, "w.random": fitR.w, referenceGroup: options.referenceGroup ?? null, level,
  };
}

/**
 * P-scores (netmeta's `netrank()`, Ruecker and Schwarzer 2015): for each treatment the mean over the others of the
 * probability that it is better, pnorm((TE_j - TE_i) / se_ij) when small values are desirable (default) or
 * pnorm((TE_i - TE_j) / se_ij) when undesirable.
 *
 * @category Meta-analysis
 */
export function netrank(fit: NetmetaResult, options: { random?: boolean; smallValues?: "desirable" | "undesirable" } = {}): Record<string, number> {
  const T = options.random === false ? fit["TE.common"] : fit["TE.random"]; const S = options.random === false ? fit["seTE.common"] : fit["seTE.random"];
  const sign = (options.smallValues ?? "desirable") === "desirable" ? 1 : -1; const n = fit.trts.length; const out: Record<string, number> = {};
  fit.trts.forEach((t, i) => {
    // P(i better than j) = pnorm((TE_j - TE_i) / se) with small values desirable, TE[j][i] = theta_j - theta_i
    let s = 0; for (let j = 0; j < n; j++) if (j !== i) s += pnorm((sign * T.values[j]![i]!) / S.values[i]![j]!) as number;
    out[t] = s / (n - 1);
  });
  return out;
}

/** One column of {@link netsplit}. */
export interface NetsplitPart { comparison: string[]; TE: number[]; seTE: number[]; lower: number[]; upper: number[]; z: number[]; p: number[] }

/**
 * Direct and indirect evidence for each comparison (netmeta's `netsplit()`, back-calculation): the direct estimate (the
 * inverse-variance pooling of the comparison's contrasts), the indirect one from the network estimate and the direct
 * one, their difference, and the direct evidence proportion v_network / v_direct.
 *
 * @category Meta-analysis
 */
export function netsplit(fit: NetmetaResult): Record<"direct.random" | "indirect.random" | "compare.random" | "direct.common" | "indirect.common" | "compare.common", NetsplitPart> & { "prop.random": number[]; "prop.common": number[] } {
  const n = fit.trts.length; const z = qnorm(0.5 + fit.level / 2) as number; const comps: [number, number][] = [];
  // pairs in treatment order; a pair with the reference group is written "other:reference" (as netmeta)
  const ref = fit.referenceGroup === null ? -1 : fit.trts.indexOf(fit.referenceGroup);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) comps.push(i === ref ? [j, i] : [i, j]);
  comps.sort((a, b) => (a[1] === ref ? 0 : 1) - (b[1] === ref ? 0 : 1));
  const part = (te: number[], se: number[], label: string[]): NetsplitPart => ({
    comparison: label, TE: te, seTE: se, lower: te.map((t, i) => t - z * se[i]!), upper: te.map((t, i) => t + z * se[i]!),
    z: te.map((t, i) => t / se[i]!), p: te.map((t, i) => 2 * (pnorm(-Math.abs(t / se[i]!)) as number)),
  });
  const label = comps.map(([i, j]) => `${fit.trts[i]}:${fit.trts[j]}`);
  const build = (kind: "common" | "random") => {
    const N = fit[`TE.${kind}`].values, NS = fit[`seTE.${kind}`].values, D = fit[`TE.direct.${kind}`].values, DS = fit[`seTE.direct.${kind}`].values;
    const dte: number[] = [], dse: number[] = [], ite: number[] = [], ise: number[] = [], cte: number[] = [], cse: number[] = [], prop: number[] = [];
    for (const [i, j] of comps) {
      const vn = NS[i]![j]! ** 2, vd = DS[i]![j]! ** 2; dte.push(D[i]![j]!); dse.push(DS[i]![j]!);
      if (!Number.isFinite(vd)) { ite.push(N[i]![j]!); ise.push(NS[i]![j]!); cte.push(NaN); cse.push(NaN); prop.push(0); continue; }
      const p = vn / vd; prop.push(p);
      if (p >= 1 - 1e-12) { ite.push(NaN); ise.push(NaN); cte.push(NaN); cse.push(NaN); continue; }
      const vi = 1 / (1 / vn - 1 / vd); const ti = vi * (N[i]![j]! / vn - D[i]![j]! / vd);
      ite.push(ti); ise.push(Math.sqrt(vi)); cte.push(D[i]![j]! - ti); cse.push(Math.sqrt(vd + vi));
    }
    return { direct: part(dte, dse, label), indirect: part(ite, ise, label), compare: part(cte, cse, label), prop };
  };
  const r = build("random"), c = build("common");
  return { "direct.random": r.direct, "indirect.random": r.indirect, "compare.random": r.compare, "direct.common": c.direct, "indirect.common": c.indirect, "compare.common": c.compare, "prop.random": r.prop, "prop.common": c.prop };
}

/**
 * The connected components of a network (netmeta's `netconnection()`): the number of subnets, the numbers of
 * studies k, treatments n and comparisons, and the distance matrix (shortest path lengths; Infinity between subnets).
 *
 * @category Meta-analysis
 */
export function netconnection(treat1: readonly string[], treat2: readonly string[], studlab?: readonly string[]): { "n.subnets": number; k: number; n: number; m: number; D: TreatmentMatrix; subnet: Record<string, number> } {
  const trts = [...new Set([...treat1, ...treat2])].sort(); const n = trts.length;
  const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 0 : Infinity)));
  treat1.forEach((a, i) => { const x = trts.indexOf(a), y = trts.indexOf(treat2[i]!); D[x]![y] = 1; D[y]![x] = 1; });
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i]![k]! + D[k]![j]! < D[i]![j]!) D[i]![j] = D[i]![k]! + D[k]![j]!;
  const subnet: Record<string, number> = {}; let c = 0;
  for (let i = 0; i < n; i++) { if (subnet[trts[i]!] !== undefined) continue; c++; for (let j = 0; j < n; j++) if (Number.isFinite(D[i]![j]!)) subnet[trts[j]!] = c; }
  return { "n.subnets": c, k: new Set(studlab ?? treat1.map((_, i) => String(i))).size, n, m: treat1.length, D: { rows: trts, cols: trts, values: D }, subnet };
}

/** The result of {@link decompDesign}. */
export interface DecompDesignResult {
  /** Total, within designs, between designs. */
  "Q.decomp": { Q: number[]; df: number[]; pval: number[] };
  "Q.het.design": { design: string[]; Q: number[]; df: number[]; pval: number[] };
}

/** The design of each study: its treatments sorted and joined by ":". */
const designsOf = (fit: NetmetaResult): Map<string, string> => {
  const m = new Map<string, string>();
  for (const s of new Set(fit.studlab)) m.set(s, [...new Set(fit.studlab.flatMap((x, i) => (x === s ? [fit.treat1[i]!, fit.treat2[i]!] : [])))].sort().join(":"));
  return m;
};

/**
 * Q decomposed by design (netmeta's `decomp.design()`): the Q of each design = that of the network fitted to its
 * studies alone, df (studies - 1)(arms - 1); within = their sum, between = total - within. Designs are listed by their
 * number of arms, then alphabetically.
 *
 * @category Meta-analysis
 */
export function decompDesign(fit: NetmetaResult): DecompDesignResult {
  const des = designsOf(fit); const v = fit.seTE.map((s) => s * s);
  const names = [...new Set(des.values())].sort((a, b) => a.split(":").length - b.split(":").length || (a < b ? -1 : a > b ? 1 : 0));
  const Q: number[] = [], df: number[] = [];
  for (const g of names) {
    const rows = fit.studlab.map((x, i) => (des.get(x) === g ? i : -1)).filter((i) => i >= 0); const ts = g.split(":");
    const f = fitNetwork(rows.map((i) => fit.TE[i]!), rows.map((i) => v[i]!), rows.map((i) => fit.treat1[i]!), rows.map((i) => fit.treat2[i]!), rows.map((i) => fit.studlab[i]!), ts);
    Q.push(f.Q); df.push((new Set(rows.map((i) => fit.studlab[i]!)).size - 1) * (ts.length - 1));
  }
  const p = (q: number, d: number): number => (d > 0 ? (pchisq(q, d, { lowerTail: false }) as number) : NaN);
  const qw = sum(Q), dw = sum(df);
  return {
    "Q.decomp": { Q: [fit.Q, qw, fit.Q - qw], df: [fit["df.Q"], dw, fit["df.Q"] - dw], pval: [p(fit.Q, fit["df.Q"]), p(qw, dw), p(fit.Q - qw, fit["df.Q"] - dw)] },
    "Q.het.design": { design: names, Q, df, pval: Q.map((q, i) => p(q, df[i]!)) },
  };
}

/**
 * Network measures (netmeta's `netmeasures()`): the direct evidence proportion of each comparison, v_network / v_direct
 * (0 without direct evidence), for the random-effects model (default, as netmeta when the fit has one) or the
 * common-effect model. netmeta's mean path length and minimal parallelism are not provided (log 101: not reproduced).
 *
 * @category Meta-analysis
 */
export function netmeasures(fit: NetmetaResult, options: { random?: boolean } = {}): { proportion: Record<string, number> } {
  const kind = options.random === false ? "common" : "random"; const n = fit.trts.length; const DS = fit[`seTE.direct.${kind}`].values;
  const proportion: Record<string, number> = {};
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const vn = fit[`seTE.${kind}`].values[i]![j]! ** 2; const vd = DS[i]![j]! ** 2;
    proportion[`${fit.trts[i]}:${fit.trts[j]}`] = Number.isFinite(vd) ? vn / vd : 0;
  }
  return { proportion };
}

/**
 * Contrasts from arm-level data (netmeta's `pairwise()`): every pair of arms of each study (treat1 the earlier arm).
 * Binary outcomes (`event`, `n`; sm "OR", "RR" or "RD"): all arms of a study get 0.5 when any arm has 0 or n events
 * (log 74); continuous (`mean`, `sd`, `n`; sm "MD").
 *
 * @category Meta-analysis
 */
export function pairwise(data: { treat: readonly string[]; studlab: readonly string[]; n: readonly number[]; event?: readonly number[]; mean?: readonly number[]; sd?: readonly number[] }, options: { sm?: "OR" | "RR" | "RD" | "MD"; incr?: number } = {}): { TE: number[]; seTE: number[]; treat1: string[]; treat2: string[]; studlab: string[] } {
  const sm = options.sm ?? (data.event ? "OR" : "MD"); const incr = options.incr ?? 0.5;
  const out = { TE: [] as number[], seTE: [] as number[], treat1: [] as string[], treat2: [] as string[], studlab: [] as string[] };
  for (const s of [...new Set(data.studlab)]) {
    const idx = data.studlab.map((x, i) => (x === s ? i : -1)).filter((i) => i >= 0);
    const anyEdge = data.event ? idx.some((i) => data.event![i] === 0 || data.event![i] === data.n[i]) : false;
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
      const i = idx[a]!, j = idx[b]!; let te: number, se: number;
      if (sm === "MD") { te = data.mean![i]! - data.mean![j]!; se = Math.sqrt(data.sd![i]! ** 2 / data.n[i]! + data.sd![j]! ** 2 / data.n[j]!); }
      else {
        const t = anyEdge ? incr : 0; const x1 = data.event![i]! + t, x2 = data.event![j]! + t;
        if (sm === "OR") { const m1 = data.n[i]! + 2 * t, m2 = data.n[j]! + 2 * t; te = Math.log(x1 / (m1 - x1)) - Math.log(x2 / (m2 - x2)); se = Math.sqrt(1 / x1 + 1 / (m1 - x1) + 1 / x2 + 1 / (m2 - x2)); }
        else if (sm === "RR") { const m1 = data.n[i]! + t, m2 = data.n[j]! + t; te = Math.log(x1 / m1) - Math.log(x2 / m2); se = Math.sqrt(1 / x1 - 1 / m1 + 1 / x2 - 1 / m2); }
        else { const m1 = data.n[i]! + 2 * t, m2 = data.n[j]! + 2 * t; te = data.event![i]! / data.n[i]! - data.event![j]! / data.n[j]!; se = Math.sqrt((x1 * (m1 - x1)) / m1 ** 3 + (x2 * (m2 - x2)) / m2 ** 3); }
      }
      out.TE.push(te); out.seTE.push(se); out.treat1.push(data.treat[i]!); out.treat2.push(data.treat[j]!); out.studlab.push(s);
    }
  }
  return out;
}

/** The result of {@link netcomb} / {@link discomb}. */
export interface NetcombResult {
  comps: string[]; "Comp.common": number[]; "seComp.common": number[]; "Comp.random": number[]; "seComp.random": number[];
  trts: string[]; "Comb.common": number[]; "seComb.common": number[]; "Comb.random": number[]; "seComb.random": number[];
  "Q.additive": number; "df.Q.additive": number; tau2: number;
}

/**
 * The additive component network meta-analysis (netmeta's `netcomb()` / `discomb()`, Ruecker et al. 2020; the network
 * may be disconnected): treatments are "+"-joined components; the components' effects by weighted least squares on
 * X = B C (C treatment by component, the `inactive` treatment left out), Q.additive the weighted residual sum of squares
 * on comparisons - rank(X) df, tau2 by the DL generalisation with the additive hat matrix (two-arm studies; log 77).
 *
 * @category Meta-analysis
 */
export function discomb(TE: readonly number[], seTE: readonly number[], treat1: readonly string[], treat2: readonly string[], studlab: readonly string[], options: { inactive?: string; sep?: string } = {}): NetcombResult {
  const sep = options.sep ?? "+"; const trts = [...new Set([...treat1, ...treat2])].sort();
  const comps = [...new Set(trts.flatMap((t) => t.split(sep).map((c) => c.trim())))].filter((c) => c !== options.inactive).sort();
  const C = trts.map((t) => { const parts = t.split(sep).map((c) => c.trim()); return comps.map((c) => (parts.includes(c) ? 1 : 0)); });
  const m = TE.length; const X = TE.map((_, i) => comps.map((_, c) => C[trts.indexOf(treat1[i]!)]![c]! - C[trts.indexOf(treat2[i]!)]![c]!));
  const v = seTE.map((s) => s * s);
  const wls = (add: number): { beta: number[]; se: number[]; Q: number; A: Mat; w: number[] } => {
    const w = contrastWeights(v.map((x) => x + add), treat1, treat2, studlab); const XtWX = comps.map((_, a) => comps.map((__, b) => sum(X.map((r, i) => r[a]! * w[i]! * r[b]!))));
    const A = pinvSym(XtWX); const XtWy = comps.map((_, a) => sum(X.map((r, i) => r[a]! * w[i]! * TE[i]!)));
    const beta = A.map((r) => sum(r.map((x, b) => x * XtWy[b]!))); const Q = sum(TE.map((y, i) => w[i]! * (y - sum(X[i]!.map((x, a) => x * beta[a]!))) ** 2));
    return { beta, se: A.map((r, a) => Math.sqrt(r[a]!)), Q, A, w };
  };
  const c0 = wls(0); const rank = matrixRank(X); const df = m - rank;
  let tau2 = 0;
  if (df > 0) {
    const H = X.map((r) => X.map((r2, j) => sum(r.map((x, a) => x * sum(c0.A[a]!.map((y, b) => y * r2[b]!)))) * c0.w[j]!));
    const IH = H.map((r, i) => r.map((x, j) => (i === j ? 1 : 0) - x)); const tr_ = sum(IH.map((r, i) => c0.w[i]! * sum(r.map((x) => x * x))));
    tau2 = Math.max(0, (c0.Q - df) / tr_);
  }
  const cr = wls(tau2);
  const comb = (f: { beta: number[]; A: Mat }): { e: number[]; s: number[] } => ({
    e: C.map((r) => sum(r.map((x, a) => x * f.beta[a]!))), s: C.map((r) => Math.sqrt(Math.max(0, sum(r.map((x, a) => x * sum(f.A[a]!.map((y, b) => y * r[b]!))))))),
  });
  const kc = comb(c0), kr = comb(cr);
  return { comps, "Comp.common": c0.beta, "seComp.common": c0.se, "Comp.random": cr.beta, "seComp.random": cr.se, trts, "Comb.common": kc.e, "seComb.common": kc.s, "Comb.random": kr.e, "seComb.random": kr.s, "Q.additive": c0.Q, "df.Q.additive": df, tau2 };
}

/** {@link discomb} for a fitted network (netmeta's `netcomb()`). @category Meta-analysis */
export function netcomb(fit: NetmetaResult, options: { inactive?: string; sep?: string } = {}): NetcombResult {
  return discomb(fit.TE, fit.seTE, fit.treat1, fit.treat2, fit.studlab, options);
}

function matrixRank(X: Mat): number {
  const p = X[0]!.length; const G = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (__, b) => sum(X.map((r) => r[a]! * r[b]!))));
  const { values } = symmetricEigen(G); const mx = Math.max(...values.map(Math.abs)); return values.filter((l) => Math.abs(l) > 1e-10 * mx).length;
}

/**
 * The league table (netmeta's `netleague()`): the diagonal the treatments, the lower triangle [i][j] the network
 * estimate of the column treatment against the row treatment (TE[j][i]) with its interval, the upper triangle the direct
 * estimates (TE[i][j]; "." where there is none); "est (lower to upper)" with `digits` decimals, the bounds of a table
 * padded to a common width.
 *
 * @category Meta-analysis
 */
export function netleague(fit: NetmetaResult, options: { random?: boolean; digits?: number; bracket?: "(" | "["; separator?: string } = {}): string[][] {
  const kind = options.random === false ? "common" : "random"; const digits = options.digits ?? 2; const sepr = options.separator ?? " to ";
  const [ob, cb] = (options.bracket ?? "(") === "(" ? ["(", ")"] : ["[", "]"]; const z = qnorm(0.5 + fit.level / 2) as number; const n = fit.trts.length;
  const T = fit[`TE.${kind}`].values, D = fit[`TE.direct.${kind}`].values, DS = fit[`seTE.direct.${kind}`].values, Lo = fit[`lower.${kind}`].values, Up = fit[`upper.${kind}`].values;
  const cells: { est: number; lo: number; up: number }[][] = fit.trts.map((_, i) => fit.trts.map((__, j) => {
    if (i === j) return { est: NaN, lo: NaN, up: NaN };
    if (i > j) return { est: T[j]![i]!, lo: Lo[j]![i]!, up: Up[j]![i]! };
    return { est: D[i]![j]!, lo: D[i]![j]! - z * DS[i]![j]!, up: D[i]![j]! + z * DS[i]![j]! };
  }));
  const fmt = (x: number): string => x.toFixed(digits);
  const bounds = cells.flat().flatMap((c) => (Number.isFinite(c.est) ? [fmt(c.lo), fmt(c.up)] : []));
  const width = Math.max(0, ...bounds.map((b) => b.length)); const pad = (s: string): string => s.padStart(width, " ");
  return cells.map((row, i) => row.map((c, j) => (i === j ? fit.trts[i]! : Number.isFinite(c.est) ? `${fmt(c.est)} ${ob}${pad(fmt(c.lo))}${sepr}${pad(fmt(c.up))}${cb}` : ".")));
}

/**
 * The partial order of treatments over several outcomes (netmeta's `netposet()`): P the treatments by outcomes matrix of
 * ranking scores; M0 the covering relation (Hasse diagram) of "i at least as good as j in every outcome and better in
 * one" (M0[i][j] = 1: i directly above j).
 *
 * @category Meta-analysis
 */
export function netposet(P: readonly (readonly number[])[]): number[][] {
  const n = P.length; const dom = (i: number, j: number): boolean => i !== j && P[i]!.every((x, o) => x >= P[j]![o]!) && P[i]!.some((x, o) => x > P[j]![o]!);
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => {
    if (!dom(i, j)) return 0;
    for (let k = 0; k < n; k++) if (k !== i && k !== j && dom(i, k) && dom(k, j)) return 0;
    return 1;
  }));
}
