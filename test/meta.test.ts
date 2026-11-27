// meta's functions against R (test/fixtures/meta.json from oracle/meta.R; behaviour in oracle/tsmeta-behaviour.md
// Part 2, experiments/tsmeta120-log.md items 61-70, 75-76, 96-).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { metagen, pWeightedChisq, type MetaResult } from "../src/meta/metagen.js";
import { metabin, type MetabinOptions } from "../src/meta/metabin.js";
import { metacont, metacor, metainc, metamean, metaprop, metapropGlmm, metarate } from "../src/meta/metaother.js";
import { glmer } from "../src/models/glmer.js";
import { baujat, metabias, metacum, metainf, metareg, metaSubgroup, trimfill } from "../src/meta/metaextra.js";
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
/** Compare a meta result with R's: exact, except R's REML near 0 (the random part) and the tau2 interval. */
export function compareMeta(m: MetaResult, r: any, label: string): string[] {
  // near 0, R's tau2 is an artefact of the absolute stopping threshold (log 97-98: at a 1e-12 threshold, or the values
  // rescaled, R gives 1e-13 and its log-likelihood is lower than at 0): the random part is not compared there
  const loose = nearZeroReml(m, r);
  return diffFields(m as unknown as Record<string, unknown>, r, 1e-9, [...TAU_INTERVAL, ...(loose ? RANDOM_FIELDS : [])]).map((b) => `${label} ${b}`);
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

describe("metacont, metainc, metacor, metamean, metarate, metaprop (inverse variance)", () => {
  const O = fx.other; const col = (d: any[], k: string): number[] => d.map((row) => num(row[k]));
  const runs: [string, string, (k: string) => MetaResult][] = [
    ["metacont", "", (k) => { const [sm, mt] = k.split(" "); const d = O.metacont.data; return metacont(col(d, "n1"), col(d, "m1"), col(d, "sd1"), col(d, "n2"), col(d, "m2"), col(d, "sd2"), { sm: sm as "MD", methodTau: mt as "REML" }); }],
    ["metainc", "", (k) => { const [sm, me] = k.split(" "); const d = O.metainc.data; return metainc(col(d, "e1"), col(d, "t1"), col(d, "e2"), col(d, "t2"), { sm: sm as "IRR", method: me as "MH" }); }],
    ["metacor", "", (k) => { const d = O.metacor.data; return metacor(col(d, "r"), col(d, "n"), { sm: k as "ZCOR" }); }],
    ["metamean", "", (k) => { const d = O.metamean.data; return metamean(col(d, "n"), col(d, "mean"), col(d, "sd"), { sm: k as "MRAW" }); }],
    ["metarate", "", (k) => { const d = O.metarate.data; return metarate(col(d, "e"), col(d, "t"), { sm: k as "IR" }); }],
    ["metaprop", "", (k) => { const d = O.metaprop.data; return metaprop(col(d, "e"), col(d, "n"), { sm: k as "PLN" }); }],
  ];
  for (const [fn, , run] of runs) {
    it(fn, () => {
      const bad: string[] = [];
      for (const [k, r] of Object.entries(O[fn].cases as Record<string, any>)) {
        const m = run(k); bad.push(...compareMeta(m, r, k));
        if (nearZeroReml(m, r)) expect(num(r.tau2), k).toBeLessThan(1e-5);
      }
      expect(bad).toEqual([]);
    });
  }
});

describe("metaprop's GLMM", () => {
  // the random part is glmer's (nAGQ = 7): rStats.js minimises the exact AGQ deviance (exact conditional mode and rule,
  // test/glmerAgq.test.ts), lme4 an approximation of it, so the estimates differ by up to 1.2e-3 (k6, tau2 = 9) and lme4's deviance values
  // are not comparable; started at lme4's estimates our fit returns to its own optimum. Everything else exact
  for (const [set, v] of Object.entries(fx.glmm as Record<string, any>)) {
    it(set, () => {
      const m = metapropGlmm(vec(v.x), vec(v.n));
      const r = { ...v.r, Q: v.Qs, "df.Q": v.dfQs, "pval.Q": v.pvalQs };
      const random = ["TE.random", "seTE.random", "lower.random", "upper.random", "seTE.predict", "lower.predict", "upper.predict", "tau2", "tau"];
      expect(diffFields(m as unknown as Record<string, unknown>, r, 1e-9, random)).toEqual([]);
      expect(diffFields(m as unknown as Record<string, unknown>, Object.fromEntries(random.map((f) => [f, r[f]])), 2e-3)).toEqual([]);
      const study = vec(v.x).map((_, i) => `s${String(i + 1).padStart(String(vec(v.x).length).length, "0")}`);
      const fit = glmer("p ~ 1 + (1 | study)", { p: vec(v.x).map((x, i) => x / vec(v.n)[i]!), w: vec(v.n), study }, { family: "binomial", weights: "w", nAGQ: 7, start: { theta: [num(v.lme4.theta)], fixef: [num(v.lme4.fixef)] } });
      expect(Math.abs(fit.fixef[0]! - m["TE.random"])).toBeLessThan(1e-9);
      expect(Math.abs(fit.theta[0]! ** 2 - m.tau2)).toBeLessThan(1e-9 * Math.max(1, m.tau2));
    });
  }
});

describe("subgroups, metabias, trimfill, metareg, metainf, metacum, baujat", () => {
  const E = fx.extra; const TE = vec(E.TE), se = vec(E.seTE); const alloc = E.alloc as string[]; const lat = vec(E.lat);
  const cmp = (a: unknown, e: unknown, tol = 1e-9): boolean => {
    const A = Array.isArray(a) ? (a as number[]) : [a as number]; const B = vec(e);
    return A.length === B.length && A.every((x, i) => (Number.isNaN(x) && Number.isNaN(B[i]!)) || Math.abs(x - B[i]!) <= tol * Math.max(1, Math.abs(B[i]!)));
  };
  it("subgroups (metagen; tau.common)", () => {
    const bad: string[] = [];
    for (const [key, r] of Object.entries(E.subgroups as Record<string, any>)) {
      if (key.startsWith("metabin")) continue;
      const [mt, tc] = key.split(" ");
      const m = metagen(TE, se, { methodTau: mt as "REML" });
      const s = metaSubgroup(m, alloc, (rows) => metagen(rows.map((i) => TE[i]!), rows.map((i) => se[i]!), { methodTau: mt as "REML" }), { methodTau: mt as "REML", tauCommon: tc === "TRUE" });
      expect(s.levels).toEqual(r.levels);
      for (const f of Object.keys(r)) if (f !== "levels" && r[f] !== null && !cmp((s as any)[f], r[f])) bad.push(`${key} ${f}`);
    }
    expect(bad).toEqual([]);
  });
  it("subgroups (metabin MH OR)", () => {
    const b = fx.metabin.fleiss; const g = ["a", "a", "b", "b", "a", "b", "a"]; const r = E.subgroups["metabin MH OR"];
    const pick = (v: unknown[], rows: number[]): number[] => rows.map((i) => num(v[i]));
    const m = metabin(vec(b.e1), vec(b.n1), vec(b.e2), vec(b.n2), { sm: "OR" });
    const s = metaSubgroup(m, g, (rows) => metabin(pick(b.e1, rows), pick(b.n1, rows), pick(b.e2, rows), pick(b.n2, rows), { sm: "OR" }));
    for (const f of Object.keys(r)) if (f !== "levels") expect(cmp((s as any)[f], r[f]), f).toBe(true);
  });
  it("metabias", () => {
    const m = metagen(TE, se);
    for (const meth of ["Egger", "Begg", "Thompson"] as const) {
      const b = metabias(m, { method: meth }); const r = E.bias[meth];
      expect(cmp([b.statistic, b.pValue, ...b.estimate], [r.statistic, r.p, ...vec(r.estimate)]), meth).toBe(true);
      if (r.df !== null) expect(b.df).toBe(num(r.df));
    }
    for (const set of ["fleiss", "zero"] as const) {
      const d = fx.metabin[set]; const counts = { e1: vec(d.e1), n1: vec(d.n1), e2: vec(d.e2), n2: vec(d.n2) };
      const mb = metabin(counts.e1, counts.n1, counts.e2, counts.n2, { sm: "OR" });
      for (const meth of ["Harbord", "Peters", "Egger"] as const) {
        const b = metabias(mb, { method: meth, counts }); const r = E.bias[`${set} ${meth}`];
        expect(cmp([b.statistic, b.pValue, ...b.estimate], [r.statistic, r.p, ...vec(r.estimate)]), `${set} ${meth}`).toBe(true);
      }
    }
  });
  it("trimfill", () => {
    for (const [key, t] of [["trimfill", trimfill(metagen(TE, se))], ["trimfill_left", trimfill(metagen(TE.filter((_, i) => i !== 0 && i !== 3), se.filter((_, i) => i !== 0 && i !== 3)))]] as const) {
      const r = E[key];
      expect(t.k0, key).toBe(num(r.k0)); expect(t.meta.k, key).toBe(num(r.k));
      expect(cmp(t.TE, r.TE) && cmp(t.seTE, r.seTE), key).toBe(true);
      for (const f of ["TE.common", "seTE.common", "TE.random", "seTE.random", "tau2", "Q"] as const) expect(cmp(t.meta[f], r[f]), `${key} ${f}`).toBe(true);
    }
  });
  it("metareg", () => {
    const f1 = metareg(metagen(TE, se), lat.map((x) => [x]));
    const dummies = alloc.map((a) => [a === "random" ? 1 : 0, a === "systematic" ? 1 : 0]);
    const f2 = metareg(metagen(TE, se, { methodTau: "DL" }), lat.map((x, i) => [x, ...dummies[i]!]));
    for (const [f, r] of [[f1, E.metareg], [f2, E.metareg2]] as const) {
      expect(cmp((f.beta.rows as number[][]).map((x) => x[0]!), r.beta)).toBe(true);
      for (const k of ["se", "zval", "pval", "tau2", "QE", "QM", "QMp"] as const) expect(cmp((f as any)[k], r[k]), k).toBe(true);
    }
  });
  it("metainf, metacum, baujat", () => {
    const m = metagen(TE, se);
    for (const [key, f] of [["metainf", metainf(m)], ["metainf_random", metainf(m, { pooled: "random" })], ["metacum", metacum(m)], ["metacum_random", metacum(m, { pooled: "random" })]] as const)
      for (const k of ["TE", "seTE", "lower", "upper", "pval", "tau2", "I2"] as const) expect(cmp(f[k], E[key][k]), `${key} ${k}`).toBe(true);
    const bj = baujat(m); expect(cmp(bj.x, E.baujat.x) && cmp(bj.y, E.baujat.y)).toBe(true);
  });
});
