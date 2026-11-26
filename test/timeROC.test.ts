import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  timeROC, timeROCConfint, timeROCCompare, seSpPPVNPV, survivalROC, timeROCAucCurve, timeROCAucDiff, pmvnormSymmetric,
  timeROCInternals, type TimeROCResult,
} from "../src/htest/timeROC.js";
import { setSeed } from "../src/random/rng.js";
import { pbvnorm } from "../src/distributions/bvnorm.js";
import { pnorm } from "../src/distributions/normal.js";

// R fixture from oracle/timeroc.R (npm run oracle -- timeroc): timeROC 0.4.1, survivalROC 1.0.3.1, x86_64 R 4.6.2.
// The behaviour is in oracle/tdroc-behaviour.md. "ties" data sets have tied times (point estimates equal; the iid
// differs from R's by the user's choice of the tie-correct form, checked here by an infinitesimal jackknife),
// "smooth" ones none (everything equal to R's).
const fx = JSON.parse(readFileSync(new URL("./fixtures/timeroc.json", import.meta.url), "utf8")) as Record<string, any>;
type Set = { T: number[]; delta: number[]; marker: number[]; other: number[] };
const data = fx.data as Record<string, Set>;
const times = fx.times as Record<string, number[]>;
const maxDiff = (a: unknown, b: unknown): number => {
  if (typeof a === "number" || a === null) {
    if (b === null || a === null) return (a === null || Number.isNaN(a as number)) && b === null ? 0 : Infinity;
    return a === b ? 0 : Math.abs((a as number) - (b as number)) / Math.max(1, Math.abs(b as number));
  }
  const x = a as unknown[];
  const y = b as unknown[];
  if (!Array.isArray(y) || x.length !== y.length) return Infinity;
  return x.reduce<number>((m, v, i) => Math.max(m, maxDiff(v, y[i])), 0);
};
const others = (d: Set) => d.other.map((x) => [x]);

function fitFor(key: string): { fit: TimeROCResult; off: number } {
  const base = key.split("_")[0]!;
  const d = data[base]!;
  const weighting = key.includes("cox") ? "cox" : key.includes("aalen") ? "aalen" : "marginal";
  const withOther = key.endsWith("_cox") || key.endsWith("_other");
  const t = key === "ties_single" ? [10] : key === "crSmooth_ci" ? times.crCi! : times[base]!;
  const fit = timeROC(d.T, d.delta, d.marker, {
    times: t, weighting, ...(withOther ? { otherMarkers: others(d) } : {}), iid: weighting === "marginal",
  });
  return { fit, off: key === "ties_single" ? 1 : 0 }; // R adds the time 0 to a single time
}

describe("timeROC against R", () => {
  for (const [key, R] of Object.entries<any>(fx.fits)) {
    it(key, () => {
      const { fit, off } = fitFor(key);
      // Cox weights: R's cph stops about 5e-7 short of the maximum (log 40); the rest to rounding
      const tol = key.includes("cox") ? 1e-6 : 1e-13;
      const sl = (v: unknown[]) => v.slice(off);
      const ipcwT = fit.weights.method === "marginal" ? sl(R.ipcwTimes[0]) : R.ipcwTimes;
      expect(maxDiff(fit.weights.ipcwTimes, ipcwT)).toBeLessThan(tol);
      expect(maxDiff(fit.weights.ipcwSubjectTimes, R.ipcwSubject)).toBeLessThan(tol);
      expect(maxDiff(fit.cumulativeIncidence, sl(R.cumInc))).toBeLessThan(tol);
      expect(maxDiff(fit.survProb, sl(R.survProb))).toBeLessThan(tol);
      const st = fit.stats.map((s) => [s.cases, s.survivors, ...(s.otherEvents === undefined ? [] : [s.otherEvents]), s.censored]);
      expect(st).toEqual(sl(R.stats));
      expect(maxDiff(fit.tp, sl(R.tp))).toBeLessThan(tol);
      if (!fit.competingRisks) {
        expect(maxDiff(fit.auc, sl(R.auc))).toBeLessThan(tol);
        expect(maxDiff(fit.fp, sl(R.fp))).toBeLessThan(tol);
      } else {
        expect(maxDiff(fit.auc1, sl(R.auc1))).toBeLessThan(tol);
        expect(maxDiff(fit.auc2, sl(R.auc2))).toBeLessThan(tol);
        expect(maxDiff(fit.fp1, sl(R.fp1))).toBeLessThan(tol);
        expect(maxDiff(fit.fp2, sl(R.fp2))).toBeLessThan(tol);
      }
      // iid: equal without tied times; with ties the standard errors stay close (the tie-correct form)
      if (R.sd1 && fit.inference) {
        const tied = key.startsWith("ties") || key.startsWith("crTies");
        const inf = fit.inference as any;
        const sd = fit.competingRisks ? inf.sd1 : inf.sd;
        const iid = fit.competingRisks ? inf.iid1 : inf.iid;
        if (!tied) {
          expect(maxDiff(sd, sl(R.sd1))).toBeLessThan(1e-13);
          expect(maxDiff(iid, sl(R.iid1))).toBeLessThan(1e-13);
          if (fit.competingRisks) {
            expect(maxDiff(inf.sd2, R.sd2)).toBeLessThan(1e-13);
            expect(maxDiff(inf.iid2, R.iid2)).toBeLessThan(1e-13);
          }
        } else {
          expect(maxDiff(sd, sl(R.sd1))).toBeLessThan(1e-3);
        }
      }
    });
  }

  it("R's competing-risks iid fails with a single survivor; rStats.js computes", () => {
    expect(fx.errors.crSmooth_iid).toBe("incorrect number of dimensions");
    const d = data.crSmooth!;
    const fit = timeROC(d.T, d.delta, d.marker, { times: [12.7], iid: true });
    expect(fit.stats[0]!.survivors).toBe(1);
    expect(fit.competingRisks && fit.inference!.sd1.every(Number.isFinite)).toBe(true);
  });

  it("iid with cox or aalen weights is an error, as R", () => {
    expect(fx.errors.cox_iid).toMatch(/Weighting must be marginal/);
    const d = data.ties!;
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [5], weighting: "cox", iid: true })).toThrow(/marginal/);
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [5], weighting: "aalen", iid: true })).toThrow(/marginal/);
  });
});

// The infinitesimal jackknife: an independent weighted estimator (subject weights omega in every sum and in the
// censoring Kaplan-Meier, n replaced by sum omega), differentiated numerically at omega = 1, against the exact-derivative
// variant of the influence (1 / (R - C) in the Kaplan-Meier's term). It checks the tie-correct form's mechanism,
// including definition (ii)'s IF(S) = -IF(F) - IF(M).
function weightedAuc(d: Set, t: number, omega: number[], def: "i" | "ii"): number {
  const n = d.T.length;
  const us = [...new Set(d.T)].sort((a, b) => a - b);
  const G = new Map<number, number>();
  let g = 1;
  for (const u of us) {
    let R = 0;
    let C = 0;
    for (let i = 0; i < n; i++) {
      if (d.T[i]! > u || (d.T[i] === u && d.delta[i] === 0)) R += omega[i]!;
      if (d.T[i] === u && d.delta[i] === 0) C += omega[i]!;
    }
    if (R > 0) g *= 1 - C / R;
    G.set(u, g);
  }
  const Gleft = (s: number) => { let v = 1; for (const u of us) if (u < s) v = G.get(u)!; return v; };
  const Gat = (s: number) => { let v = 1; for (const u of us) if (u <= s) v = G.get(u)!; return v; };
  const a = d.T.map((T, i) => (T < t && d.delta[i] === 1 ? omega[i]! / Gleft(T) : 0));
  const c = d.T.map((T, i) => (T > t ? omega[i]! / Gat(t) : def === "ii" && T < t && d.delta[i]! > 1 ? omega[i]! / Gleft(T) : 0));
  let N = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (a[i]! > 0 && c[j]! > 0) {
    N += a[i]! * c[j]! * (d.marker[i]! > d.marker[j]! ? 1 : d.marker[i] === d.marker[j] ? 0.5 : 0);
  }
  return N / (a.reduce((s, v) => s + v, 0) * c.reduce((s, v) => s + v, 0));
}

describe("the tie-correct iid by the infinitesimal jackknife", () => {
  const { prepare, weightsAt, marginalG, aucInfluence } = timeROCInternals;
  const cases: [string, number, "i" | "ii"][] = [["ties", 5, "i"], ["ties", 10, "i"], ["crTies", 4, "i"], ["crTies", 4, "ii"], ["crTies", 8, "ii"], ["crTies", 12, "ii"]];
  for (const [name, t, def] of cases) {
    it(`${name} at t = ${t}, definition (${def})`, () => {
      const d = data[name]!;
      const n = d.T.length;
      const dat = prepare(d.T, d.delta, d.marker);
      const g = marginalG(dat, t);
      const at = weightsAt(dat, t, 1, g.gLeft, g.gAt);
      const exact = aucInfluence(dat, at, def, true).inf;
      const eps = 1e-6;
      let worst = 0;
      for (let k = 0; k < n; k++) {
        const up = Array.from({ length: n }, (_, i) => (i === k ? 1 + eps : 1));
        const dn = Array.from({ length: n }, (_, i) => (i === k ? 1 - eps : 1));
        const num = (n * (weightedAuc(d, t, up, def) - weightedAuc(d, t, dn, def))) / (2 * eps);
        worst = Math.max(worst, Math.abs(num - exact[k]!));
      }
      expect(worst).toBeLessThan(1e-6);
      // the reported (asymptotic) form stays close to the exact one
      const asym = aucInfluence(dat, at, def).inf;
      const sd = (x: number[]) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / n);
      expect(Math.abs(sd(asym) - sd(exact)) / sd(exact)).toBeLessThan(0.1);
      // the reported AUC is the centre: the iid sums to zero
      expect(Math.abs(asym.reduce((s, v) => s + v, 0) / n)).toBeLessThan(1e-12);
    });
  }

  it("independent of the data order within tied times", () => {
    const d = data.ties!;
    const n = d.T.length;
    const perm = Array.from({ length: n }, (_, i) => n - 1 - i);
    const f1 = timeROC(d.T, d.delta, d.marker, { times: times.ties!, iid: true });
    const f2 = timeROC(perm.map((i) => d.T[i]!), perm.map((i) => d.delta[i]!), perm.map((i) => d.marker[i]!), { times: times.ties!, iid: true });
    if (f1.competingRisks || f2.competingRisks) throw new Error("unexpected");
    expect(maxDiff(f1.inference!.sd, f2.inference!.sd)).toBeLessThan(1e-14);
  });
});

describe("confint against R", () => {
  const r2 = (m: [number, number][]) => m.map((r) => r.map((v) => Math.round(v * 100) / 100));
  const s = data.smooth!;
  const fit = timeROC(s.T, s.delta, s.marker, { times: times.smooth!, iid: true });

  it("pointwise intervals and the band (R rounds to 2 decimals; rStats.js does not)", () => {
    setSeed(1);
    const c = timeROCConfint(fit);
    const R = fx.confint.smooth;
    expect(r2(c.auc!.ci)).toEqual(R.CI_AUC);
    expect(r2(c.auc!.band)).toEqual(R.CB_AUC);
    expect(Math.abs(c.auc!.cAlpha - R["C.alpha"])).toBeLessThan(1e-13);
    expect(c.auc!.ci[0]![0]).not.toBe(R.CI_AUC[0][0]); // not rounded
    setSeed(7);
    const c90 = timeROCConfint(fit, { level: 0.9, nSim: 500 });
    expect(r2(c90.auc!.ci)).toEqual(fx.confint.smooth90.CI_AUC);
    expect(Math.abs(c90.auc!.cAlpha - fx.confint.smooth90["C.alpha"])).toBeLessThan(1e-13);
  });

  it("competing risks: one set of draws for both definitions (log 49)", () => {
    const d = data.crSmooth!;
    const f = timeROC(d.T, d.delta, d.marker, { times: times.crCi!, iid: true });
    setSeed(3);
    const c = timeROCConfint(f);
    const R = fx.confint.crSmooth;
    expect(Math.abs(c.auc1!.cAlpha - R["C.alpha.1"])).toBeLessThan(1e-13);
    expect(Math.abs(c.auc2!.cAlpha - R["C.alpha.2"])).toBeLessThan(1e-13);
    expect(r2(c.auc1!.ci)).toEqual(R.CI_AUC_1);
    expect(r2(c.auc2!.band)).toEqual(R.CB_AUC_2);
  });
});

describe("compare against R", () => {
  it("single event", () => {
    const s = data.smooth!;
    const x = timeROC(s.T, s.delta, s.marker, { times: times.smooth!, iid: true });
    const y = timeROC(s.T, s.delta, s.other, { times: times.smooth!, iid: true });
    const k = timeROCCompare(x, y, { adjusted: true });
    expect(maxDiff(timeROCCompare(x, y).auc!.pValues, fx.compare.smooth.p_values_AUC)).toBeLessThan(1e-13);
    expect(maxDiff(k.auc!.pValues, fx.compare.smoothAdj.p_values_AUC[0])).toBeLessThan(1e-13);
    expect(maxDiff(k.auc!.cor, fx.compare.smoothAdj.Cor)).toBeLessThan(1e-13);
    // R's adjusted p-values come from a randomized integration with absolute tolerance 1e-3 (log 50)
    expect(maxDiff(k.auc!.adjusted, fx.compare.smoothAdj.p_values_AUC[1])).toBeLessThan(1e-4);
  });

  it("competing risks", () => {
    const d = data.crSmooth!;
    const x = timeROC(d.T, d.delta, d.marker, { times: times.crCi!, iid: true });
    const y = timeROC(d.T, d.delta, d.other, { times: times.crCi!, iid: true });
    const k = timeROCCompare(x, y, { adjusted: true });
    const R = fx.compare.crSmoothAdj;
    expect(maxDiff(k.auc1!.pValues, R.p_values_AUC_1[0])).toBeLessThan(1e-13);
    expect(maxDiff(k.auc2!.pValues, R.p_values_AUC_2[0])).toBeLessThan(1e-13);
    expect(maxDiff(k.auc1!.cor, R.Cor[0])).toBeLessThan(1e-13);
    expect(maxDiff(k.auc2!.cor, R.Cor[1])).toBeLessThan(1e-13);
    expect(maxDiff(k.auc1!.adjusted, R.p_values_AUC_1[1])).toBeLessThan(1e-4);
    expect(maxDiff(k.auc2!.adjusted, R.p_values_AUC_2[1])).toBeLessThan(1e-4);
  });

  it("refuses fits of different subjects or without iid", () => {
    const s = data.smooth!;
    const x = timeROC(s.T, s.delta, s.marker, { times: times.smooth!, iid: true });
    const y = timeROC(s.T.map((v) => v + 1), s.delta, s.other, { times: times.smooth!, iid: true });
    expect(() => timeROCCompare(x, y)).toThrow(/same subjects/);
    expect(() => timeROCCompare(x, timeROC(s.T, s.delta, s.other, { times: times.smooth! }))).toThrow(/iid/);
  });
});

describe("the multivariate normal probability of compare", () => {
  it("three dimensions against an independent lattice-free integral", () => {
    const C = [[1, 0.56, 0.23], [0.56, 1, 0.56], [0.23, 0.56, 1]];
    // independent: Simpson over Z_1 with the conditional bivariate probability on a fine grid
    const indep = (b: number) => {
      const s2 = Math.sqrt(1 - 0.56 ** 2), s3 = Math.sqrt(1 - 0.23 ** 2), rho = (0.56 - 0.56 * 0.23) / (s2 * s3);
      const M = 20000;
      const h = (2 * b) / M;
      let tot = 0;
      for (let k = 0; k <= M; k++) {
        const x = -b + k * h;
        const f = (Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)) * pbvnorm([(-b - 0.56 * x) / s2, (-b - 0.23 * x) / s3], [(b - 0.56 * x) / s2, (b - 0.23 * x) / s3], rho);
        tot += f * (k === 0 || k === M ? 1 : k % 2 ? 4 : 2);
      }
      return (tot * h) / 3;
    };
    for (const b of [0.5, 1.7, 3.2]) expect(Math.abs(pmvnormSymmetric(b, C) - indep(b))).toBeLessThan(1e-11);
  });

  it("four dimensions (the lattice rule) against the equicorrelated closed form", () => {
    const C = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i === j ? 1 : 0.5)));
    // equicorrelation 1/2: Z_j = (W + E_j) / sqrt 2, so P = E[(P(|W + E| <= b sqrt 2 | W))^4]
    const exact = (b: number) => {
      const M = 40000, L = 12, h = (2 * L) / M;
      let t = 0;
      for (let k = 0; k < M; k++) {
        const z = -L + (k + 0.5) * h;
        const p = pbvnorm([-Infinity, -Infinity], [b * Math.SQRT2 - z, Infinity], 0) - pbvnorm([-Infinity, -Infinity], [-b * Math.SQRT2 - z, Infinity], 0);
        t += h * (Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)) * p ** 4;
      }
      return t;
    };
    expect(Math.abs(pmvnormSymmetric(1, C) - exact(1))).toBeLessThan(2e-7);
  }, 60000);
});

describe("SeSpPPVNPV against R", () => {
  const runs: [string, string, number, "marginal" | "cox", boolean][] = [
    ["smooth", "smooth", 0.2, "marginal", true], ["crSmooth", "crSmooth", 0.2, "marginal", true],
    ["ties", "ties", fx.sespppv.cut_ties, "marginal", true], ["crTies", "crTies", 0.3, "marginal", false],
    ["smoothCox", "smooth", 0.2, "cox", false],
  ];
  for (const [key, base, cut, weighting, iid] of runs) {
    it(key, () => {
      const d = data[base]!;
      const R = fx.sespppv[key];
      const r = seSpPPVNPV(cut, d.T, d.delta, d.marker, { times: times[base]!, weighting, iid, ...(weighting === "cox" ? { otherMarkers: others(d) } : {}) });
      const tol = weighting === "cox" ? 1e-6 : 1e-13;
      expect(maxDiff(r.tp, R.TP)).toBeLessThan(tol);
      expect(maxDiff(r.ppv, R.PPV)).toBeLessThan(tol);
      if (r.competingRisks) {
        for (const [a, b] of [["fp1", "FP_1"], ["fp2", "FP_2"], ["npv1", "NPV_1"], ["npv2", "NPV_2"]] as const) expect(maxDiff(r[a], R[b])).toBeLessThan(tol);
      } else {
        expect(maxDiff(r.fp, R.FP)).toBeLessThan(tol);
        expect(maxDiff(r.npv, R.NPV)).toBeLessThan(tol);
      }
      const st = r.stats.map((s) => [s.cases, s.survivors, ...(s.otherEvents === undefined ? [] : [s.otherEvents]), s.censored, s.positive, s.negative]);
      expect(st).toEqual(R.stats);
      if (iid) {
        const tied = base === "ties";
        for (const [a, b] of [["se", "Se"], ["sp1", "Sp1"], ["sp2", "Sp2"], ["ppv", "PPV"], ["npv1", "NPV1"], ["npv2", "NPV2"]] as const) {
          const diff = maxDiff(r.inference!.se[a], R.se[`vect_se_${b}`]);
          // with tied times: Sp1 is the same in both forms here; the others move a little; Sp2 has R's 1 - F
          if (!tied) expect(diff, a).toBeLessThan(1e-13);
          else expect(diff, a).toBeLessThan(a === "sp2" ? 0.1 : 1e-2);
        }
      }
    });
  }
});

describe("survivalROC (KM) against R", () => {
  const runs: [string, string, number, number[] | undefined][] = [
    ["ties", "ties", 8, undefined], ["smooth", "smooth", 6.3, undefined], ["cuts", "smooth", 6.3, [-1, 0, 0.5, 1.5]], ["late", "ties", 30, undefined],
  ];
  for (const [key, base, pt, cuts] of runs) {
    it(key, () => {
      const d = data[base]!;
      const R = fx.survivalROC[key];
      const r = survivalROC(d.T, d.delta.map((x) => (x === 1 ? 1 : 0)), d.marker, { predictTime: pt, ...(cuts ? { cutValues: cuts } : {}) });
      expect(r.cutValues[0]).toBe(-Infinity);
      expect(maxDiff(r.cutValues.slice(1), R["cut.values"].slice(1))).toBe(0);
      expect(maxDiff(r.tp, R.TP)).toBeLessThan(1e-13);
      expect(maxDiff(r.fp, R.FP)).toBeLessThan(1e-13);
      expect(Math.abs(r.auc - R.AUC)).toBeLessThan(1e-13);
      expect(Math.abs(r.survival - R.Survival)).toBeLessThan(1e-14);
    });
  }

  it("NNE is not offered", () => {
    const d = data.smooth!;
    expect(() => survivalROC(d.T, d.delta, d.marker, { predictTime: 5, method: "NNE" as "KM" })).toThrow(/NNE/);
  });
});

describe("the values behind plotAUCcurve and plotAUCcurveDiff", () => {
  it("agree with confint and compare", () => {
    const s = data.smooth!;
    const x = timeROC(s.T, s.delta, s.marker, { times: times.smooth!, iid: true });
    const y = timeROC(s.T, s.delta, s.other, { times: times.smooth!, iid: true });
    setSeed(1);
    const c = timeROCAucCurve(x);
    setSeed(1);
    const ci = timeROCConfint(x);
    expect(c.lower.map((v) => v * 100)).toEqual(ci.auc!.ci.map((r) => r[0]));
    expect(c.bandUpper.map((v) => v * 100)).toEqual(ci.auc!.band.map((r) => r[1]));
    const dd = timeROCAucDiff(x, y);
    if (x.competingRisks || y.competingRisks) throw new Error("unexpected");
    expect(maxDiff(dd.diff, x.auc.map((v, j) => v - y.auc[j]!))).toBeLessThan(1e-15);
    // the half width over 1.96 is the standard error behind compare's p-value
    const p = timeROCCompare(x, y).auc!.pValues;
    dd.diff.forEach((v, j) => {
      const se = (dd.upper[j]! - dd.lower[j]!) / (2 * 1.959963984540054);
      const z = Math.abs(v) / se;
      expect(Math.abs(p[j]! - 2 * (pnorm(-z) as number))).toBeLessThan(1e-13);
    });
  });
});
