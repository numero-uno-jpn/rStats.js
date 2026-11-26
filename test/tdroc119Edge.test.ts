import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  timeROC, timeROCConfint, timeROCCompare, seSpPPVNPV, survivalROC, timeROCAucCurve, timeROCAucDiff,
  type TimeROCResult,
} from "../src/htest/timeROC.js";
import { setSeed } from "../src/random/rng.js";

// The comprehensive edge pass of 1.19.0 (every published function on every axis): scales 1e±150 and 1e±300 of the
// marker and of the times, a common value 1e8, mixed scales, degenerate data, NA, large n, and R's values from
// experiments/tdroc119-edge.R and tdroc119-edge2.R (log 51, 52).
const fx = JSON.parse(readFileSync(new URL("./fixtures/timeroc.json", import.meta.url), "utf8")) as Record<string, any>;
const lastLine = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8").trim().split("\n").at(-1)!);
const E = lastLine("../experiments/tdroc119-edge.json"); // rms's cph prints to stdout before the JSON
const E2 = lastLine("../experiments/tdroc119-edge2.json");
type Set = { T: number[]; delta: number[]; marker: number[]; other: number[] };
const ties = fx.data.ties as Set;
const crTies = fx.data.crTies as Set;
const smooth = fx.data.smooth as Set;
const rel = (a: unknown, b: unknown): number => {
  if (a === undefined || b === undefined) return a === b ? 0 : Infinity;
  if (typeof a === "number") {
    const y = b as number;
    if (Number.isNaN(a) || Number.isNaN(y)) return Number.isNaN(a) && Number.isNaN(y) ? 0 : Infinity;
    return a === y ? 0 : Math.abs(a - y) / Math.max(1e-300, Math.abs(y));
  }
  const x = a as unknown[];
  const y = b as unknown[];
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return Infinity;
  return x.reduce<number>((m, v, i) => Math.max(m, rel(v, y[i])), 0);
};
const summary = (f: TimeROCResult) => (f.competingRisks
  ? [f.auc1, f.auc2, f.fp1, f.fp2, f.tp, f.cumulativeIncidence, f.survProb, f.inference?.sd1, f.inference?.sd2, f.inference?.iid2]
  : [f.auc, f.fp, f.tp, f.cumulativeIncidence, f.survProb, f.inference?.sd, f.inference?.iid]);
const SCALES = [1e150, 1e-150, 1e300, 1e-300];

describe("scales of the marker and the times", () => {
  for (const [name, d, times] of [["ties", ties, [5, 10, 15]], ["crTies", crTies, [4, 8, 12]], ["smooth", smooth, [4.1, 8.3, 12.7]]] as const) {
    const base = timeROC(d.T, d.delta, d.marker, { times: [...times], iid: true });
    const baseCox = timeROC(d.T, d.delta, d.marker, { times: [...times], weighting: "cox", otherMarkers: d.other.map((x) => [x]) });
    const baseAalen = timeROC(d.T, d.delta, d.marker, { times: [...times], weighting: "aalen", otherMarkers: d.other.map((x) => [x]) });
    const baseSp = seSpPPVNPV(0.2, d.T, d.delta, d.marker, { times: [...times], iid: true });
    const baseSr = survivalROC(d.T, d.delta.map((x) => (x === 1 ? 1 : 0)), d.marker, { predictTime: times[1] });
    for (const s of SCALES) {
      it(`${name}: marker x ${s}`, () => {
        const M = d.marker.map((x) => x * s);
        const OM = d.other.map((x) => [x * s]);
        // marginal weights use the marker's order only: exactly the same
        expect(rel(summary(timeROC(d.T, d.delta, M, { times: [...times], iid: true })), summary(base))).toBe(0);
        // Cox and Aalen: the covariate's scale is absorbed by the coefficient (Aalen: by its own scaling by powers of 2)
        expect(rel(summary(timeROC(d.T, d.delta, M, { times: [...times], weighting: "cox", otherMarkers: OM })), summary(baseCox))).toBeLessThan(1e-12);
        expect(rel(summary(timeROC(d.T, d.delta, M, { times: [...times], weighting: "aalen", otherMarkers: OM })), summary(baseAalen))).toBeLessThan(1e-12);
        const sp = seSpPPVNPV(0.2 * s, d.T, d.delta, M, { times: [...times], iid: true });
        expect(rel([sp.tp, sp.ppv, sp.inference!.se.ppv, sp.inference!.se.sp2], [baseSp.tp, baseSp.ppv, baseSp.inference!.se.ppv, baseSp.inference!.se.sp2])).toBe(0);
        const sr = survivalROC(d.T, d.delta.map((x) => (x === 1 ? 1 : 0)), M, { predictTime: times[1] });
        expect(rel([sr.tp, sr.fp, sr.auc], [baseSr.tp, baseSr.fp, baseSr.auc])).toBe(0);
      });
      it(`${name}: times x ${s}`, () => {
        const T = d.T.map((x) => x * s);
        const ts = times.map((x) => x * s);
        expect(rel(summary(timeROC(T, d.delta, d.marker, { times: ts, iid: true })), summary(base))).toBe(0);
        // Cox: the order of the times only (coxph's timefix is off; R's cph is not scale-free at 1e-300, log 51)
        expect(rel(summary(timeROC(T, d.delta, d.marker, { times: ts, weighting: "cox", otherMarkers: d.other.map((x) => [x]) })), summary(baseCox))).toBeLessThan(1e-12);
        expect(rel(summary(timeROC(T, d.delta, d.marker, { times: ts, weighting: "aalen", otherMarkers: d.other.map((x) => [x]) })), summary(baseAalen))).toBe(0);
        const sp = seSpPPVNPV(0.2, T, d.delta, d.marker, { times: ts, iid: true });
        expect(rel([sp.tp, sp.ppv, sp.npv ?? sp.npv1, sp.inference!.se.se], [baseSp.tp, baseSp.ppv, baseSp.npv ?? baseSp.npv1, baseSp.inference!.se.se])).toBe(0);
        const sr = survivalROC(T, d.delta.map((x) => (x === 1 ? 1 : 0)), d.marker, { predictTime: times[1] * s });
        expect(rel([sr.tp, sr.fp, sr.auc, sr.survival], [baseSr.tp, baseSr.fp, baseSr.auc, baseSr.survival])).toBe(0);
      });
    }
    it(`${name}: a common value 1e8 in the times and the covariates`, () => {
      const T = d.T.map((x) => 1e8 + x);
      const ts = times.map((x) => 1e8 + x);
      expect(rel(summary(timeROC(T, d.delta, d.marker, { times: ts, iid: true })), summary(base))).toBe(0);
      expect(rel(summary(timeROC(T, d.delta, d.marker, { times: ts, weighting: "aalen", otherMarkers: d.other.map((x) => [x]) })), summary(baseAalen))).toBe(0);
      // the covariates 1e8 + x carry x to 1.5e-8 only: the weights move by about that much
      const cox = timeROC(T, d.delta, d.marker.map((x) => 1e8 + x), { times: ts, weighting: "cox", otherMarkers: d.other.map((x) => [1e8 + x]) });
      expect(rel(cox.weights.ipcwTimes, baseCox.weights.ipcwTimes)).toBeLessThan(1e-5);
      const aal = timeROC(T, d.delta, d.marker.map((x) => 1e8 + x), { times: ts, weighting: "aalen", otherMarkers: d.other.map((x) => [1e8 + x]) });
      expect(rel(aal.weights.ipcwTimes, baseAalen.weights.ipcwTimes)).toBeLessThan(1e-5);
    });
  }

  it("mixed scales: markers from 1e-300 to 1e300 count by their order", () => {
    const d = smooth;
    const rank = d.marker.map((x) => d.marker.filter((y) => y < x).length);
    const M = rank.map((r) => (r % 2 ? 1 : -1) * 0 + 10 ** (-300 + (600 * r) / (d.marker.length - 1)));
    const a = timeROC(d.T, d.delta, M, { times: [4.1, 8.3], iid: true });
    const b = timeROC(d.T, d.delta, rank, { times: [4.1, 8.3], iid: true });
    expect(rel(summary(a), summary(b))).toBe(0);
    const c = survivalROC(d.T, d.delta, M, { predictTime: 6.3 });
    const e = survivalROC(d.T, d.delta, rank, { predictTime: 6.3 });
    expect(rel([c.tp, c.fp, c.auc], [e.tp, e.fp, e.auc])).toBe(0);
  });

  it("confint, compare and the curves are invariant too", () => {
    const d = smooth;
    const t = [4.1, 8.3, 12.7];
    const x = timeROC(d.T, d.delta, d.marker, { times: t, iid: true });
    const y = timeROC(d.T, d.delta, d.other, { times: t, iid: true });
    const xs = timeROC(d.T.map((v) => v * 1e-300), d.delta, d.marker.map((v) => v * 1e300), { times: t.map((v) => v * 1e-300), iid: true });
    const ys = timeROC(d.T.map((v) => v * 1e-300), d.delta, d.other.map((v) => v * 1e-300), { times: t.map((v) => v * 1e-300), iid: true });
    setSeed(4);
    const c1 = timeROCConfint(x, { nSim: 300 });
    setSeed(4);
    const c2 = timeROCConfint(xs, { nSim: 300 });
    expect(rel([c1.auc!.ci, c1.auc!.band, c1.auc!.cAlpha], [c2.auc!.ci, c2.auc!.band, c2.auc!.cAlpha])).toBe(0);
    const k1 = timeROCCompare(x, y, { adjusted: true });
    const k2 = timeROCCompare(xs, ys, { adjusted: true });
    expect(rel([k1.auc!.pValues, k1.auc!.adjusted, k1.auc!.cor], [k2.auc!.pValues, k2.auc!.adjusted, k2.auc!.cor])).toBe(0);
    expect(rel(Object.values(timeROCAucDiff(x, y)).slice(1), Object.values(timeROCAucDiff(xs, ys)).slice(1))).toBe(0);
    setSeed(4);
    const a1 = timeROCAucCurve(x, { nSim: 100 });
    setSeed(4);
    expect(rel(Object.values(a1).slice(1), Object.values(timeROCAucCurve(xs, { nSim: 100 })).slice(1))).toBe(0);
  });
});

describe("degenerate data against R (log 51, 52)", () => {
  const d = ties;
  const auc = (f: TimeROCResult) => (f.competingRisks ? f.auc1 : f.auc);
  const sd = (f: TimeROCResult) => (f.competingRisks ? f.inference?.sd1 : f.inference?.sd);
  const nan = (v: number[] | undefined) => (v ?? []).every(Number.isNaN);

  it("equal markers: AUC 1/2, the TP and FP rows 0 and 1, sd about 0", () => {
    const f = timeROC(d.T, d.delta, d.T.map(() => 1), { times: [5, 10], iid: true });
    expect(auc(f)).toEqual(E.equalMarkers.AUC);
    expect(f.tp).toEqual([[0, 1], [0, 1]]);
    expect(Math.max(...sd(f)!)).toBeLessThan(1e-15);
  });

  it("no case or no control: NaN (R's NA)", () => {
    for (const t of [0.5, Math.max(...d.T), 1e6]) {
      const f = timeROC(d.T, d.delta, d.marker, { times: [t], iid: true });
      expect(nan(auc(f)) && nan(sd(f))).toBe(true);
    }
    expect(E.beforeFirst.AUC[1] === null && E.beyondMax.AUC[1] === null && E.atMax.AUC[1] === null).toBe(true);
    expect(nan(auc(timeROC(d.T, d.T.map(() => 0), d.marker, { times: [5], iid: true })))).toBe(true);
    const ca = timeROC(crTies.T, crTies.delta, crTies.marker, { times: [5], cause: 3, iid: true });
    expect(ca.competingRisks && nan(ca.auc1) && nan(ca.auc2)).toBe(true);
  });

  it("no censoring, negative times and an NA marker as R", () => {
    const f = timeROC(d.T, d.T.map(() => 1), d.marker, { times: [5], iid: true });
    expect(rel([auc(f), sd(f)], [[E.noCensoring.AUC[1]], [E.noCensoring.sd1[1]]])).toBeLessThan(1e-13);
    const g = timeROC(d.T.map((x) => x - 10), d.delta, d.marker, { times: [-5, 0], iid: true });
    expect(rel(auc(g), E.negativeT.AUC)).toBeLessThan(1e-13);
    const h = timeROC(d.T, d.delta, d.marker.map((x, i) => (i ? x : NaN)), { times: [5] });
    expect(h.n).toBe(39);
    expect(rel(auc(h), [E.naMarker.AUC[1]])).toBeLessThan(1e-13);
    expect(h.stats).toEqual([{ cases: 16, survivors: 15, censored: 8 }]);
  });

  it("n = 2 works (R fails); n = 1 is NaN", () => {
    expect(E.n2.error).toBe("incorrect number of dimensions");
    const f = timeROC([3, 8], [1, 0], [0.5, 0.1], { times: [5], iid: true });
    expect(auc(f)).toEqual([1]);
    expect(nan(auc(timeROC([3], [1], [0.5], { times: [5], iid: true })))).toBe(true);
  });

  it("Cox weights: degenerate covariates and no censoring work (R fails); all censored NaN", () => {
    expect(E.coxConstOther.error).toMatch(/invalid formula/);
    expect(E.coxNoCensoring.error).toMatch(/missing value/);
    const only = timeROC(d.T, d.delta, d.marker, { times: [5, 10], weighting: "cox" });
    expect(rel(auc(only), E.coxMarkerOnly.AUC)).toBeLessThan(1e-6);
    for (const other of [d.T.map(() => [1]), d.marker.map((m) => [2 * m])]) {
      expect(rel(auc(timeROC(d.T, d.delta, d.marker, { times: [5, 10], weighting: "cox", otherMarkers: other })), auc(only))).toBeLessThan(1e-9);
    }
    const none = timeROC(d.T, d.T.map(() => 1), d.marker, { times: [5], weighting: "cox" });
    expect(rel(auc(none), [E.noCensoring.AUC[1]])).toBeLessThan(1e-13);
    expect(nan(auc(timeROC(d.T, d.T.map(() => 0), d.marker, { times: [5], weighting: "cox" })))).toBe(true);
    // the covariate at 1e300: as R
    expect(rel(auc(timeROC(d.T, d.delta, d.marker.map((x) => x * 1e300), { times: [5, 10], weighting: "cox" })), E.coxMarker300.AUC)).toBeLessThan(1e-6);
    expect(rel(auc(timeROC(d.T.map((x) => x + 1e8), d.delta, d.marker, { times: [5 + 1e8, 10 + 1e8], weighting: "cox" })), E.common1e8cox.AUC)).toBeLessThan(1e-6);
  });

  it("Aalen weights: a dependent covariate is left out (R silently uses weights 1)", () => {
    const s = smooth;
    const only = timeROC(s.T, s.delta, s.marker, { times: [4.1, 8.3], weighting: "aalen" });
    expect(rel(auc(only), E2.aalen.markerOnly)).toBeLessThan(1e-13);
    expect(rel(E2.aalen.collinear, E2.aalen.unweighted)).toBeLessThan(1e-15);
    for (const other of [s.T.map(() => [1]), s.marker.map((m) => [2 * m])]) {
      expect(rel(auc(timeROC(s.T, s.delta, s.marker, { times: [4.1, 8.3], weighting: "aalen", otherMarkers: other })), auc(only))).toBeLessThan(1e-12);
    }
    expect(rel(auc(timeROC(d.T, d.delta, d.T.map(() => 1), { times: [5, 10], weighting: "aalen" })), E.aalenConstMarker.AUC)).toBeLessThan(1e-15);
    expect(rel(auc(timeROC(d.T, d.T.map(() => 1), d.marker, { times: [5], weighting: "aalen" })), [E.aalenNoCensoring.AUC[1]])).toBeLessThan(1e-13);
  });

  it("SeSpPPVNPV with the cutpoint beyond the markers as R", () => {
    const a = seSpPPVNPV(100, d.T, d.delta, d.marker, { times: [5], iid: true });
    expect([a.tp[0], a.fp![0]]).toEqual([0, 0]);
    expect(Number.isNaN(a.ppv[0]!)).toBe(true);
    expect(rel(a.npv, [E.sespAbove.NPV[1]])).toBeLessThan(1e-13);
    expect(a.inference!.se.se).toEqual([0]);
    const b = seSpPPVNPV(-100, d.T, d.delta, d.marker, { times: [5], iid: true });
    expect([b.tp[0], b.fp![0]]).toEqual([1, 1]);
    expect(rel(b.ppv, [E.sespBelow.PPV[1]])).toBeLessThan(1e-13);
    expect(Number.isNaN(b.npv![0]!)).toBe(true);
    expect(seSpPPVNPV(Infinity, d.T, d.delta, d.marker, { times: [5] }).stats[0]!.positive).toBe(0);
  });

  it("confint leaves a NaN time out of the band (as R leaves out its row)", () => {
    const s = smooth;
    const f = timeROC(s.T, s.delta, s.marker, { times: [0.1, 4.1, 8.3], iid: true });
    const g = timeROC(s.T, s.delta, s.marker, { times: [4.1, 8.3], iid: true });
    setSeed(2);
    const a = timeROCConfint(f, { nSim: 200 });
    setSeed(2);
    const b = timeROCConfint(g, { nSim: 200 });
    expect(a.auc!.cAlpha).toBe(b.auc!.cAlpha);
    expect(a.auc!.ci[0]!.every(Number.isNaN)).toBe(true);
    expect(a.auc!.ci.slice(1)).toEqual(b.auc!.ci);
  });

  it("compare of a marker with itself: NaN p-values (R stops)", () => {
    const x = timeROC(d.T, d.delta, d.marker, { times: [5, 10, 15], iid: true });
    const k = timeROCCompare(x, timeROC(d.T, d.delta, d.marker, { times: [5, 10, 15], iid: true }), { adjusted: true });
    expect(k.auc!.pValues.every(Number.isNaN) && k.auc!.adjusted!.every(Number.isNaN)).toBe(true);
  });

  it("survivalROC: thresholds, ends of time and degenerate markers", () => {
    const s = smooth;
    for (const [k, cuts] of [["c10", [1.0]], ["c15", [1.5]], ["c0_10", [0, 1]], ["c10_30", [1, 3]], ["c05_0", [0.5, 0]], ["c0_0", [0, 0]]] as const) {
      const r = survivalROC(s.T, s.delta, s.marker, { predictTime: 6.3, cutValues: [...cuts] });
      expect(rel([r.tp, r.fp], [E2.cuts[k].TP, E2.cuts[k].FP]), k).toBeLessThan(1e-13);
    }
    expect(survivalROC(d.T, d.delta, d.marker, { predictTime: 8, cutValues: [0] }).auc).toBeCloseTo(E.srocOneCut.AUC, 14);
    const late = survivalROC(d.T, d.delta, d.marker, { predictTime: 1e6 });
    expect(rel([late.auc, late.survival], [E.srocAfterLast.AUC, E.srocAfterLast.Survival])).toBeLessThan(1e-13);
    expect(survivalROC(d.T, d.delta, d.T.map(() => 1), { predictTime: 8 }).auc).toBe(0.5);
    const cens = survivalROC(d.T, d.T.map(() => 0), d.marker, { predictTime: 5 });
    expect(cens.survival).toBe(1);
    expect(Number.isNaN(cens.auc)).toBe(true);
    // before the first time: S = 1 and TP is 0 / 0 (R reads the Kaplan-Meier at the first time instead, 0.95; log 52)
    const early = survivalROC(d.T, d.delta, d.marker, { predictTime: 0.5 });
    expect(early.survival).toBe(1);
    expect(E.srocBeforeFirst.Survival).toBe(0.95);
    expect(Number.isNaN(early.tp[1]!)).toBe(true);
  });
});

describe("invalid input", () => {
  const d = ties;
  it("errors", () => {
    expect(() => timeROC(d.T, d.delta.map(() => 0.5), d.marker, { times: [5] })).toThrow(/integers/);
    expect(() => timeROC(d.T, d.delta, d.marker.map((x, i) => (i ? x : Infinity)), { times: [5] })).toThrow(/finite/);
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [] })).toThrow(/at least one/);
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [Infinity] })).toThrow(/finite/);
    expect(() => timeROC(d.T, d.delta.slice(1), d.marker, { times: [5] })).toThrow(/same length/);
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [5], cause: 0 })).toThrow(/cause/);
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [5], otherMarkers: d.marker.map((m) => [m]) })).toThrow(/cox and aalen/);
    expect(() => timeROC(d.T, d.delta, d.marker, { times: [5], weighting: "cox", otherMarkers: [[1]] })).toThrow(/one row per subject/);
    expect(() => timeROC(d.T.map(() => NaN), d.delta, d.marker, { times: [5] })).toThrow(/no subjects/);
    expect(() => timeROCConfint(timeROC(d.T, d.delta, d.marker, { times: [5] }))).toThrow(/iid/);
    expect(() => timeROCConfint(timeROC(d.T, d.delta, d.marker, { times: [5], iid: true }), { level: 1 })).toThrow(/level/);
    expect(() => seSpPPVNPV(NaN, d.T, d.delta, d.marker, { times: [5] })).toThrow(/cutpoint/);
    expect(() => survivalROC(d.T, d.delta.map((x) => x * 2), d.marker, { predictTime: 5 })).toThrow(/status/);
    expect(() => survivalROC(d.T, d.delta, d.marker, { predictTime: NaN })).toThrow(/predictTime/);
  });
});

describe("large n", () => {
  it("n = 5000: iid, Cox, Aalen, SeSpPPVNPV, survivalROC and confint in a few seconds", () => {
    setSeed(11);
    const n = 5000;
    let seed = 7;
    const u = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const M = Array.from({ length: n }, () => u());
    const T0 = M.map((m) => -Math.log(u()) / Math.exp(m));
    const C = M.map(() => -2 * Math.log(u()));
    const T = T0.map((t, i) => Math.min(t, C[i]!));
    const D = T0.map((t, i) => (t <= C[i]! ? 1 : 0));
    const t0 = performance.now();
    const f = timeROC(T, D, M, { times: [0.3, 0.6, 1], iid: true });
    timeROC(T, D, M, { times: [0.3, 0.6, 1], weighting: "cox" });
    timeROC(T, D, M, { times: [0.3, 0.6, 1], weighting: "aalen" });
    seSpPPVNPV(0.5, T, D, M, { times: [0.3, 0.6, 1], iid: true });
    survivalROC(T, D, M, { predictTime: 0.6 });
    timeROCConfint(f, { nSim: 500 });
    expect(performance.now() - t0).toBeLessThan(15000);
    if (f.competingRisks) throw new Error("unexpected");
    expect(f.auc.every((v) => v > 0.5 && v < 0.7)).toBe(true);
    expect(f.inference!.sd.every((v) => v > 0 && v < 0.05)).toBe(true);
  }, 60000);
});
