// Edge cases of the plot-data functions (1.21.0): degenerate and small inputs, missing values, extreme scales
// (1e±300) and common values, every function on every axis that applies. The values are those of the functions they
// rearrange (checked against R elsewhere); here the layers must stay consistent and finite where the inputs are.
import { describe, expect, it } from "vitest";
import { cuminc, hist, lm, metagen, prcomp, rma, roc, survfit } from "../src/index.js";
import { netmeta } from "../src/entries/tests.js";
import { acf, meanf } from "../src/entries/timeseries.js";
import { dist, hclust } from "../src/entries/multivariate.js";
import {
  acfPlotData, biplotData, boxplotData, coefPlotData, cumincPlotData, dendrogramData, densityPlotData, ecdfPlotData,
  forecastPlotData, forestPlotData, funnelPlotData, histPlotData, lmDiagnosticsData, netgraphData, predictionBandData,
  qqPlotData, rocPlotData, survPlotData,
} from "../src/entries/plot.js";

const SCALES = [1e-300, 1e-150, 1, 1e150, 1e300];
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), Number.MIN_VALUE);

describe("survPlotData edge cases", () => {
  it("all censored, one subject, ties, a single stratum", () => {
    const a = survPlotData(survfit([3, 5, 7], [0, 0, 0]));
    expect(a.layers.steps.map((r) => r.y)).toEqual([1, 1, 1, 1]);
    expect(a.layers.censor.length).toBe(3);
    const one = survPlotData(survfit([4], [1]));
    expect(one.layers.steps.map((r) => [r.x, r.y])).toEqual([[0, 1], [4, 0]]);
    const ties = survPlotData(survfit([2, 2, 2, 5], [1, 1, 0, 1]));
    expect(ties.layers.censor).toEqual([{ x: 2, y: 0.5, group: "all", n: 1 }]);
  });
  it("survival 0: the band where R has none, cloglog's infinities", () => {
    const d = survPlotData(survfit([1, 2, 3], [1, 1, 1]));
    expect(d.layers.steps.at(-1)!.y).toBe(0);
    const c = survPlotData(survfit([1, 2, 3], [1, 1, 1]), { fun: "cloglog" });
    expect(c.layers.steps.at(-1)!.y).toBe(Infinity);
    const e = survPlotData(survfit([1, 2, 3], [1, 1, 1]), { fun: "event" });
    expect(e.layers.steps.at(-1)!.y).toBe(1);
  });
  it("times at any scale and a common value", () => {
    // (below about 1e-8 survfit merges the four times into one, as R's timefix: experiment 6)
    for (const s of [1, 1e150, 1e300]) {
      const d = survPlotData(survfit([1, 2, 3, 4].map((t) => t * s), [1, 0, 1, 1]));
      expect(d.layers.steps.map((r) => r.y)).toEqual([1, 0.75, 0.75, 0.375, 0]);
      expect(d.layers.riskTable.length).toBeGreaterThan(1);
      expect(d.layers.riskTable[0]!.nRisk).toBe(4);
    }
    const c = survPlotData(survfit([1, 2, 3, 4].map((t) => 1e15 + t), [1, 0, 1, 1]));
    expect(c.layers.steps[0]!.x).toBe(0);
    expect(c.layers.riskTable.length).toBeGreaterThan(1);
  });
  it("negative times start the curve at the first time", () => {
    const d = survPlotData(survfit([-2, 1, 3], [1, 1, 0]));
    expect(d.layers.steps[0]!.x).toBe(-2);
  });
  it("cuminc with one cause", () => {
    expect(cumincPlotData(cuminc([1, 2, 3], [1, 1, 0])).layers.steps.length).toBeGreaterThan(0);
  });
});

describe("rocPlotData edge cases", () => {
  it("perfect separation, ties, the scale of the predictor", () => {
    const p = rocPlotData(roc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]));
    expect(p.meta.auc).toBe(1);
    expect(p.layers.best[0]!.youden).toBe(1);
    const t = rocPlotData(roc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]));
    expect(t.meta.auc).toBe(0.5);
    for (const s of SCALES) {
      const r = rocPlotData(roc([0, 0, 1, 1, 0, 1], [1, 4, 3.5, 8, 2, 9].map((v) => v * s)));
      expect(r.layers.curve.map((c) => c.y)).toEqual(rocPlotData(roc([0, 0, 1, 1, 0, 1], [1, 4, 3.5, 8, 2, 9])).layers.curve.map((c) => c.y));
    }
  });
});

describe("forestPlotData and funnelPlotData edge cases", () => {
  it("one study, equal standard errors, scales", () => {
    const m1 = metagen([0.3], [0.1]);
    const f1 = forestPlotData(m1);
    expect(f1.layers.studies[0]!.weight).toBe(100);
    expect(f1.layers.studies[0]!.y).toBe(1);
    const eq = funnelPlotData(metagen([0.1, 0.3, 0.2], [0.2, 0.2, 0.2]));
    expect(eq.layers.region.at(-1)!.y).toBeCloseTo(0.2, 15);
    // (tau2 is not representable at 1e300 (overflow: the random effects weights are then NaN) nor at 1e-300 (it
    // underflows to 0: the random effects weights are then the common effect ones); R's metagen stops at both ends,
    // experiment 6)
    const c300 = forestPlotData(metagen([0.21, 0.52, -0.08].map((t) => t * 1e-300), [0.11, 0.21, 0.16].map((t) => t * 1e-300)), { random: false });
    const c1 = forestPlotData(metagen([0.21, 0.52, -0.08], [0.11, 0.21, 0.16]), { random: false });
    c300.layers.studies.forEach((r, i) => expect(rel(r.weight, c1.layers.studies[i]!.weight)).toBeLessThan(1e-12));
    expect(forestPlotData(metagen([0.21, 0.52, -0.08].map((t) => t * 1e300), [0.11, 0.21, 0.16].map((t) => t * 1e300)), { random: false })
      .layers.studies.map((r) => Math.round(r.weight * 1e6))).toEqual(c1.layers.studies.map((r) => Math.round(r.weight * 1e6)));
    // (from 1.21.0 metagen's REML iterates to the maximum, so tau2 at 1e±150 is the scaled tau2 at 1; before, its
    // absolute stopping rule left them 3.4e-6 apart)
    for (const s of [1e-150, 1, 1e150]) {
      const m = metagen([0.21, 0.52, -0.08].map((t) => t * s), [0.11, 0.21, 0.16].map((t) => t * s));
      const f = forestPlotData(m);
      const base = forestPlotData(metagen([0.21, 0.52, -0.08], [0.11, 0.21, 0.16]));
      f.layers.studies.forEach((r, i) => {
        expect(rel(r.weight, base.layers.studies[i]!.weight)).toBeLessThan(1e-10);
        expect(rel(r.lower, base.layers.studies[i]!.lower * s)).toBeLessThan(1e-10);
      });
      const u = funnelPlotData(m).layers.region.at(-1)!;
      expect(Number.isFinite(u.xmin) && Number.isFinite(u.xmax)).toBe(true);
    }
  });
  it("a common value and an exp transform that overflows", () => {
    const m = metagen([1e15 + 0.2, 1e15 + 0.5], [0.1, 0.2]);
    expect(forestPlotData(m).layers.studies[0]!.estimate).toBe(1e15 + 0.2);
    const big = forestPlotData(metagen([800, 801], [1, 1]), { transform: Math.exp });
    expect(big.layers.studies[0]!.upper).toBe(Infinity);
  });
  it("rma with moderators is refused; options are checked", () => {
    const f = rma([0.1, 0.3, 0.2, 0.5], [0.01, 0.02, 0.015, 0.03], { mods: [[1], [2], [3], [4]] });
    expect(() => forestPlotData(f)).toThrow(RangeError);
    expect(() => forestPlotData(metagen([0.1, 0.2], [0.1, 0.1]), { level: 1 })).toThrow(RangeError);
    expect(() => funnelPlotData(metagen([0.1, 0.2], [0.1, 0.1]), { n: 1 })).toThrow(RangeError);
  });
  it("netgraph: two treatments, a multi-arm study counted once per pair", () => {
    const d = netgraphData(netmeta([0.3, 0.1], [0.1, 0.2], ["A", "A"], ["B", "B"], ["s1", "s2"]));
    expect(d.layers.edges).toHaveLength(1);
    expect(d.layers.edges[0]!.studies).toBe(2);
    const m = netgraphData({ trts: ["A", "B", "C"], studlab: ["s1", "s1", "s1"], treat1: ["A", "A", "B"], treat2: ["B", "C", "C"] });
    expect(m.layers.edges.map((e) => e.studies)).toEqual([1, 1, 1]);
  });
});

describe("distribution plots edge cases", () => {
  it("one value, two values, constant data, missing values", () => {
    expect(qqPlotData([5]).layers.points).toEqual([{ x: 0, y: 5, index: 0 }]);
    expect(() => qqPlotData([NaN])).toThrow(RangeError);
    expect(ecdfPlotData([NaN]).layers.steps).toEqual([]);
    expect(ecdfPlotData([2, 2, 2]).layers.steps).toEqual([{ x: 2, y: 1 }]);
    const b = boxplotData({ a: [], b: [1] });
    expect(b.layers.boxes[0]!.n).toBe(0);
    expect(Number.isNaN(b.layers.boxes[0]!.median)).toBe(true);
    expect(densityPlotData([2.5, 2.5, 2.5]).layers.curve.every((r) => Number.isFinite(r.y))).toBe(true);
    expect(densityPlotData([1, NaN, 3], { naRm: true }).layers.rug).toEqual([{ x: 1 }, { x: 3 }]);
    expect(histPlotData([4]).layers.bars.length).toBeGreaterThan(0);
  });
  it("scales and a common value", () => {
    for (const s of SCALES) {
      const y = [3.1, 1.2, 5.5, 1.2, 9.0].map((v) => v * s);
      const q = qqPlotData(y);
      expect(rel(q.meta.slope as number, (qqPlotData([3.1, 1.2, 5.5, 1.2, 9.0]).meta.slope as number) * s)).toBeLessThan(1e-14);
      expect(boxplotData(y).layers.boxes[0]!.median).toBe(3.1 * s);
      expect(ecdfPlotData(y).layers.steps.length).toBe(4);
      expect(histPlotData(y).layers.bars.reduce((t, r) => t + r.count, 0)).toBe(5);
    }
    const c = densityPlotData([1, 2, 3].map((v) => 1e15 + v));
    expect(c.layers.curve.every((r) => Number.isFinite(r.y))).toBe(true);
    expect(histPlotData(hist([1e15 + 1, 1e15 + 2, 1e15 + 3])).layers.bars.length).toBeGreaterThan(0);
  });
});

describe("model plots edge cases", () => {
  it("lmDiagnosticsData: the smallest fit, an exact fit, scales", () => {
    const small = lmDiagnosticsData(lm([1, 2, 3], [1, 3, 2]));
    expect(small.layers.residualsFitted).toHaveLength(3);
    const exact = lmDiagnosticsData(lm([1, 2, 3, 4], [3, 5, 7, 9]));
    expect(exact.layers.leverage.length).toBeLessThanOrEqual(4);
    const base = lmDiagnosticsData(lm([1, 2, 3, 4, 10, 6, 7], [1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1]));
    for (const s of SCALES) {
      const d = lmDiagnosticsData(lm([1, 2, 3, 4, 10, 6, 7].map((v) => v * s), [1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1].map((v) => v * s)));
      d.layers.leverage.forEach((r, i) => {
        expect(rel(r.x, base.layers.leverage[i]!.x)).toBeLessThan(1e-10);
        expect(rel(r.cooks, base.layers.leverage[i]!.cooks)).toBeLessThan(1e-8);
      });
      expect(d.layers.residualsFittedSmooth.every((r) => Number.isFinite(r.y))).toBe(true);
    }
    expect(exact.layers.qq.length).toBeLessThanOrEqual(4);
  });
  it("coefPlotData, predictionBandData, rank deficiency", () => {
    const f = lm([[1, 2], [2, 4], [3, 6], [4, 8.5], [5, 10]], [1, 3, 2, 5, 4]);
    expect(coefPlotData(f).layers.coefficients).toHaveLength(3);
    expect(() => coefPlotData(f, { level: 0 })).toThrow(RangeError);
    const g = lm([1, 2, 3, 4, 5], [1.1, 1.9, 3.2, 3.9, 5.1]);
    expect(predictionBandData(g, [[3], [6]]).layers.band.map((r) => r.x)).toEqual([3, 6]);
  });
  it("acfPlotData and forecastPlotData", () => {
    const a = acfPlotData(acf([1, 2, 1, 2, 1, 2]));
    expect(a.layers.band.every((r) => r.upper === a.meta.clim)).toBe(true);
    const f = forecastPlotData([1, 2, 3], meanf([1, 2, 3], { h: 2, level: [50, 99] }));
    expect(f.layers.intervals.map((r) => r.level)).toEqual([99, 99, 50, 50]);
    expect(() => forecastPlotData([1, 2, 3], meanf([1, 2, 3], { h: 1 }), { frequency: 0 })).toThrow(RangeError);
  });
});

describe("dendrogramData and biplotData edge cases", () => {
  it("two leaves, ties in the heights, scales", () => {
    const two = dendrogramData(hclust(dist([[0], [1]])));
    expect(two.layers.nodes).toEqual([{ x: 1.5, y: 1, merge: 1 }]);
    const tie = dendrogramData(hclust(dist([[0], [1], [2], [3]])));
    expect(tie.layers.nodes.map((n) => n.y)).toEqual([1, 1, 3]);
    for (const s of SCALES) {
      const d = dendrogramData(hclust(dist([1, 2, 6, 7, 15].map((v) => [v * s]))));
      expect(d.layers.leaves.map((l) => l.x)).toEqual([1, 2, 3, 4, 5]);
      expect(d.layers.segments.every((r) => Number.isFinite(r.y1) && Number.isFinite(r.y2))).toBe(true);
    }
  });
  it("biplot at scales; one component is refused for choices [1, 2]", () => {
    const X = [[1, 2], [2, 3.5], [3, 3], [4, 6], [5, 5.5]];
    const base = biplotData(prcomp(X));
    for (const s of SCALES) {
      const b = biplotData(prcomp(X.map((r) => r.map((v) => v * s))));
      expect(rel(Math.abs(b.layers.observations[0]!.x), Math.abs(base.layers.observations[0]!.x))).toBeLessThan(1e-10);
      expect(rel(Math.abs(b.layers.variables[0]!.x), Math.abs(base.layers.variables[0]!.x) * s)).toBeLessThan(1e-10);
    }
    expect(() => biplotData(prcomp([[1], [2], [4]]))).toThrow(RangeError);
  });
});

describe("the new statistics at every scale (1e±300) and with a common value", () => {
  const x = [1, 2, 3, 4, 10, 6, 7], y = [1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1];
  it("lm influence measures are scale-invariant", async () => {
    const { lmHatvalues, lmRstandard, lmRstudent, lmCooksDistance } = await import("../src/index.js");
    const b = lm(x, y);
    const base = [lmHatvalues(b), lmRstandard(b), lmRstudent(b), lmCooksDistance(b)];
    for (const s of SCALES) {
      const f = lm(x.map((v) => v * s), y.map((v) => v * s));
      [lmHatvalues(f), lmRstandard(f), lmRstudent(f), lmCooksDistance(f)].forEach((m, k) =>
        m.forEach((v, i) => expect(rel(v, base[k]![i]!), `measure ${k} at ${s}`).toBeLessThan(1e-8)));
    }
    const c = lm(x, y.map((v) => 1e8 + v));
    lmRstandard(c).forEach((v, i) => expect(rel(v, base[1]![i]!)).toBeLessThan(1e-6));
  });
  it("qqline, bandwidths and density with weights", async () => {
    const { qqline, bwNrd0, bwNrd, density } = await import("../src/index.js");
    const l1 = qqline(y), b0 = bwNrd0(y), b1 = bwNrd(y);
    const d1 = density(y, { weights: y.map((v) => v / 32.7) });
    for (const s of SCALES) {
      const ys = y.map((v) => v * s);
      expect(rel(qqline(ys).slope, l1.slope * s)).toBeLessThan(1e-14);
      expect(rel(bwNrd0(ys), b0 * s)).toBeLessThan(1e-14);
      expect(rel(bwNrd(ys), b1 * s)).toBeLessThan(1e-14);
      const d = density(ys, { weights: y.map((v) => v / 32.7) });
      const peak = Math.max(...d1.y);
      d.y.forEach((v, i) => expect(Math.abs(v * s - d1.y[i]!) / peak).toBeLessThan(1e-10));
    }
  });
});
