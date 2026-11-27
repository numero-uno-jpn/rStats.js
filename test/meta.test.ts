// meta's functions against R (test/fixtures/meta.json from oracle/meta.R; behaviour in oracle/tsmeta-behaviour.md
// Part 2, experiments/tsmeta120-log.md items 61-70, 75-76, 96-).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { metagen, pWeightedChisq, type MetaResult } from "../src/meta/metagen.js";
import { metabin, type MetabinOptions } from "../src/meta/metabin.js";
import { symmetricEigen } from "../src/random/mvrnorm.js";
import { qchisq } from "../src/distributions/chisq.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/meta.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const vec = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
/** Fields whose relative difference from R exceeds tol (NaN must match NaN). */
export function diffFields(m: Record<string, unknown>, r: Record<string, unknown>, tol: number, skip: readonly string[] = []): string[] {
  const bad: string[] = [];
  for (const [f, ev] of Object.entries(r)) {
    if (ev === null || skip.includes(f)) continue;
    const e = vec(ev); const av = m[f]; const a = Array.isArray(av) ? (av as number[]) : [av as number];
    if (a.length !== e.length) { bad.push(`${f}: length ${a.length} vs ${e.length}`); continue; }
    e.forEach((x, i) => {
      const y = a[i]!;
      if (Number.isNaN(x) || Number.isNaN(y)) { if (Number.isNaN(x) !== Number.isNaN(y)) bad.push(`${f}[${i}]: ${y} vs ${x}`); return; }
      if (Math.abs(y - x) > tol * Math.max(1, Math.abs(x))) bad.push(`${f}[${i}]: ${y} vs ${x}`);
    });
  }
  return bad;
}
const optionsOf = (name: string): Record<string, unknown> => {
  const p = name.split(" ");
  if (name === "level90") return { levelMa: 0.9, levelPredict: 0.8 };
  if (name.includes("tauci")) return { methodTau: p[0], methodTauCi: p[2] };
  return { methodTau: p[0], methodRandomCi: p[1] };
};
/** P(Q_a <= q_obs) at tau2 for the generalised Q with weights a. */
const genqCdf = (y: number[], v: number[], a: number[], t2: number): number => {
  const k = y.length; const sa = a.reduce((p, q) => p + q, 0); const mu = a.reduce((p, w, i) => p + w * y[i]!, 0) / sa;
  const q = a.reduce((p, w, i) => p + w * (y[i]! - mu) ** 2, 0); const s = v.map((x) => Math.sqrt(x + t2));
  const M = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => s[i]! * ((i === j ? a[i]! : 0) - (a[i]! * a[j]!) / sa) * s[j]!));
  return pWeightedChisq(q, symmetricEigen(M).values.map((l) => Math.max(0, l)));
};
const qGen = (y: number[], v: number[], t2: number): number => {
  const w = v.map((x) => 1 / (x + t2)); const sw = w.reduce((a, b) => a + b, 0); const mu = w.reduce((a, wi, i) => a + wi * y[i]!, 0) / sw;
  return w.reduce((a, wi, i) => a + wi * (y[i]! - mu) ** 2, 0);
};

describe("metagen", () => {
  for (const [set, s] of Object.entries(fx.metagen as Record<string, any>)) {
    const TE = vec(s.TE), se = vec(s.seTE), v = se.map((x) => x * x);
    it(set, () => {
      const bad: string[] = [];
      for (const [name, r] of Object.entries(s.cases as Record<string, any>)) {
        const m = metagen(TE, se, optionsOf(name)) as unknown as MetaResult;
        const tauci = m.methodTauCi;
        // R's roots (uniroot's default tolerance, about 1.2e-4): PM's and EB's tau2 (Q(tau2) = k - 1) and the tau2
        // intervals are checked by their equations; everything else exactly
        const pm = (m.methodTau === "PM" || m.methodTau === "EB") && m.tau2 > 0;
        const skip = ["lower.tau2", "upper.tau2", "lower.tau", "upper.tau"];
        for (const b of diffFields(m as unknown as Record<string, unknown>, r, pm ? 1e-4 : 1e-9, skip)) bad.push(`${name} ${b}`);
        if (pm) expect(Math.abs(qGen(TE, v, m.tau2) - (TE.length - 1))).toBeLessThan(1e-9);
        // the tau2 interval: Q-profile (Q(tau2) at the chi-squared quantiles) or the generalised Q (its cdf at 0.975,
        // 0.025); ours solves the equation, R's is within its root tolerance
        const a = tauci === "J" ? se.map((x) => 1 / x) : v.map((x) => 1 / x);
        for (const [bound, target] of [["lower.tau2", 0.975], ["upper.tau2", 0.025]] as const) {
          const mine = m[bound]; const rv = num(r[bound]);
          const eq = (t2: number): number => (tauci === "QP" ? qGen(TE, v, t2) - (qchisq(target, TE.length - 1) as number) : genqCdf(TE, v, a, t2) - target);
          if (mine > 0) expect(Math.abs(eq(mine)), `${set} ${name} ${bound}`).toBeLessThan(1e-8);
          if (rv > 0) expect(Math.abs(eq(rv)), `${set} ${name} ${bound} R`).toBeLessThan(tauci === "QP" ? 1e-2 : 1e-4);
          expect(Math.abs(mine - rv), `${set} ${name} ${bound}`).toBeLessThan(1.3e-4);
          expect(Math.abs(Math.sqrt(mine) - num(r[bound.replace("tau2", "tau")])), `${set} ${name} tau`).toBeLessThan(5e-4);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});

const TAU_INTERVAL = ["lower.tau2", "upper.tau2", "lower.tau", "upper.tau"];
/** R's REML stops at threshold 1e-5 approaching tau2 = 0 (metafor's default; log 97): ours is the boundary itself. */
const nearZeroReml = (m: MetaResult, r: any): boolean => m.methodTau === "REML" && m.tau2 === 0 && num(r.tau2) > 0 && num(r.tau2) < 1e-5;
const RANDOM_FIELDS = ["TE.random", "seTE.random", "lower.random", "upper.random", "statistic.random", "pval.random", "seTE.predict", "lower.predict", "upper.predict", "tau2", "tau", "w.random"];
/** Compare a meta result with R's: exact, except R's REML near 0 (the random part to 1e-3, tau = sqrt(tau2) not compared) and the tau2 interval. */
export function compareMeta(m: MetaResult, r: any, label: string): string[] {
  const loose = nearZeroReml(m, r);
  const bad = diffFields(m as unknown as Record<string, unknown>, r, 1e-9, [...TAU_INTERVAL, ...(loose ? RANDOM_FIELDS : [])]).map((b) => `${label} ${b}`);
  if (loose) bad.push(...diffFields(m as unknown as Record<string, unknown>, Object.fromEntries(RANDOM_FIELDS.filter((f) => f !== "tau").map((f) => [f, r[f]])), 1e-3).map((b) => `${label} (near 0) ${b}`));
  return bad;
}

describe("metabin", () => {
  for (const [set, s] of Object.entries(fx.metabin as Record<string, any>)) {
    it(set, () => {
      const bad: string[] = [];
      for (const [name, r] of Object.entries(s.cases as Record<string, any>)) {
        const p = name.split(" "); const o: MetabinOptions = { sm: p[0] as "RR", method: p[1] as "MH", methodTau: p[2] as "REML" };
        if (name.endsWith("exact")) o.MHexact = true;
        if (name.endsWith("allstudies")) o.allstudies = true;
        if (name.endsWith("incr1")) o.incr = 1;
        if (name.endsWith(" all")) o.methodIncr = "all";
        if (name.endsWith("if0all")) o.methodIncr = "if0all";
        if (name.endsWith("QnotCochrane")) o.QCochrane = false;
        bad.push(...compareMeta(metabin(vec(s.e1), vec(s.n1), vec(s.e2), vec(s.n2), o), r, name));
      }
      expect(bad).toEqual([]);
    });
  }
});
