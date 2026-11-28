// The plot-data functions of /plot (1.21.0): their layers against R where R gives the values (test/fixtures/plotdata.json
// from oracle/plotdata.R: dendrogram midpoints, meta's forest, survival's risk table) and against the functions they
// rearrange.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  boxplotStats, cuminc, density, ecdf, fromRows, hist, lm, lmCooksDistance, lmHatvalues, lmRstandard, lowess,
  metagen, prcomp, qnorm, qqline, qqnorm, roc, rma, survfit,
} from "../src/index.js";
import { netmeta } from "../src/entries/tests.js";
import { acf, arima, forecast } from "../src/entries/timeseries.js";
import { dist, hclust } from "../src/entries/multivariate.js";
import {
  acfPlotData, biplotData, boxplotData, coefPlotData, cumincPlotData, dendrogramData, densityPlotData, ecdfPlotData,
  forecastPlotData, forestPlotData, funnelPlotData, histPlotData, lmDiagnosticsData, netgraphData, predictionBandData,
  qqPlotData, rocPlotData, survPlotData,
} from "../src/entries/plot.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/plotdata.json", import.meta.url), "utf8")) as Record<string, any>;
const close = (a: number, b: number, tol = 1e-13) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));

describe("survPlotData", () => {
  const r = fx.risk;
  const fit = survfit(r.time, r.status, { group: r.group });
  it("steps start at (0, 1) per stratum and follow the fit", () => {
    const d = survPlotData(fit);
    const groups = [...new Set(fit.strata)];
    for (const g of groups) {
      const s = d.layers.steps.filter((p) => p.group === g);
      expect(s[0]).toEqual({ x: 0, y: 1, ymin: 1, ymax: 1, group: g });
      const rows = fit.strata.flatMap((t, i) => (t === g ? [i] : []));
      expect(s.slice(1).map((p) => p.y)).toEqual(rows.map((i) => fit.surv[i]));
      expect(s.slice(1).map((p) => p.ymin)).toEqual(rows.map((i) => fit.lower[i]));
    }
    expect(d.layers.censor.map((c) => c.x)).toEqual([8, 20, 9, 22]);
  });
  it("the risk table as R's summary(fit, times)", () => {
    const d = survPlotData(fit, { riskTimes: r.times });
    expect(d.layers.riskTable.map((t) => t.nRisk)).toEqual(r["n.risk"]);
    // the default times are pretty(c(0, last time)), as in the fixture
    expect(survPlotData(fit).layers.riskTable.map((t) => t.x)).toEqual([...r.times, ...r.times]);
  });
  it("fun", () => {
    const e = survPlotData(fit, { fun: "event" }).layers.steps;
    const s = survPlotData(fit).layers.steps;
    e.forEach((p, i) => {
      close(p.y, 1 - s[i]!.y, 1e-15);
      if (Number.isFinite(p.ymin)) close(p.ymin, 1 - s[i]!.ymax, 1e-15);
    });
    const c = survPlotData(fit, { fun: "cloglog" }).layers.steps;
    expect(c.length).toBe(fit.time.length);
    close(c[0]!.x, Math.log(fit.time[0]!));
    const h = survPlotData(fit, { fun: "cumhaz" }).layers.steps;
    expect(h.filter((p) => p.x > 0).map((p) => p.y)).toEqual(fit.cumhaz);
    expect(() => survPlotData(fit, { fun: "log" as "surv" })).toThrow(RangeError);
  });
  it("cumincPlotData", () => {
    const ci = cuminc([1, 2, 3, 4, 5, 6], [1, 2, 1, 0, 2, 1]);
    const d = cumincPlotData(ci);
    expect(d.layers.steps.length).toBe(ci.curves.reduce((s, c) => s + c.time.length, 0));
    expect(d.layers.steps[0]!.group).toBe(ci.curves[0]!.name);
  });
});

describe("rocPlotData", () => {
  const r = roc([0, 0, 1, 1, 0, 1, 0, 1], [0.1, 0.4, 0.35, 0.8, 0.2, 0.9, 0.5, 0.7]);
  it("the curve from (0, 0) to (1, 1) and the best Youden point", () => {
    const d = rocPlotData(r);
    const c = d.layers.curve;
    expect([c[0]!.x, c[0]!.y]).toEqual([0, 0]);
    expect([c.at(-1)!.x, c.at(-1)!.y]).toEqual([1, 1]);
    for (let i = 1; i < c.length; i++) expect(c[i]!.x).toBeGreaterThanOrEqual(c[i - 1]!.x);
    const j = Math.max(...r.sensitivities.map((s, i) => s + r.specificities[i]! - 1));
    close(d.layers.best[0]!.youden as number, j, 1e-15);
    expect(d.meta.auc).toBe(r.auc);
  });
});

describe("forestPlotData and funnelPlotData", () => {
  const TE = [0.21, 0.52, -0.08, 0.35, 0.11, 0.62], seTE = [0.11, 0.21, 0.16, 0.12, 0.09, 0.3];
  for (const lv of ["0.95", "0.9"]) {
    it(`meta's forest values at level ${lv}`, () => {
      const e = fx.forest[lv];
      const m = metagen(TE, seTE, { methodTau: "REML", methodRandomCi: "HK", level: Number(lv) });
      const d = forestPlotData(m, { level: Number(lv), prediction: true });
      d.layers.studies.forEach((s, i) => {
        close(s.lower, e.lower[i]);
        close(s.upper, e.upper[i]);
        close(s.weight, e.wr[i]);
        expect(s.y).toBe(TE.length - i);
      });
      const c = forestPlotData(m, { level: Number(lv), random: false }).layers.studies;
      c.forEach((s, i) => close(s.weight, e.wc[i]));
      const [pc, pr, pp] = d.layers.pooled;
      close(pc!.estimate, e.TEc); close(pc!.lower, e.lc); close(pc!.upper, e.uc);
      close(pr!.estimate, e.TEr); close(pr!.lower, e.lr); close(pr!.upper, e.ur);
      close(pp!.lower, e.lp); close(pp!.upper, e.up);
      expect(d.layers.diamonds.length).toBe(10);
    });
  }
  it("labels, transform and rma", () => {
    const m = metagen(TE, seTE);
    const d = forestPlotData(m, { labels: ["a", "b", "c", "d", "e", "f"], transform: Math.exp });
    expect(d.layers.studies[0]!.label).toBe("a");
    close(d.layers.studies[0]!.estimate, Math.exp(0.21));
    expect(() => forestPlotData(m, { labels: ["a"] })).toThrow(RangeError);
    const f = rma(TE, seTE.map((s) => s * s));
    const r = forestPlotData(f);
    expect(r.layers.pooled.map((p) => p.type)).toEqual(["random"]);
    const w = seTE.map((s) => 1 / (s * s + f.tau2));
    close(r.layers.studies[0]!.weight, (100 * w[0]!) / w.reduce((a, b) => a + b, 0));
  });
  it("funnel region and contours", () => {
    const m = metagen(TE, seTE);
    const d = funnelPlotData(m, { contours: [0.9, 0.95] });
    expect(d.layers.studies.length).toBe(6);
    const last = d.layers.region.at(-1)!;
    close(last.y, 0.3);
    close(last.xmax - last.xmin, 2 * qnorm(0.975) * 0.3);
    close((last.xmax + last.xmin) / 2, m["TE.common"]);
    expect(d.layers.contours.length).toBe(100);
    expect(funnelPlotData(m, { reference: "random" }).meta.reference).toBe(m["TE.random"]);
    expect(funnelPlotData(m, { reference: 0 }).meta.reference).toBe(0);
  });
  it("netgraphData", () => {
    const fit = netmeta([0.3, 0.5, 0.2, 0.4], [0.1, 0.2, 0.15, 0.2], ["A", "A", "B", "A"], ["B", "C", "C", "B"], ["s1", "s2", "s3", "s4"]);
    const d = netgraphData(fit);
    expect(d.layers.nodes.map((n) => n.label)).toEqual(fit.trts);
    close(d.layers.nodes[0]!.y, 1);
    expect(d.layers.edges.map((e) => [e.from, e.to, e.studies])).toEqual([["A", "B", 2], ["A", "C", 1], ["B", "C", 1]]);
  });
});

describe("distribution plots", () => {
  const y = [3.1, 1.2, 5.5, 1.2, 9.0, 4.4, NaN];
  it("qqPlotData", () => {
    const d = qqPlotData(y);
    const q = qqnorm(y);
    expect(d.layers.points.map((p) => p.x)).toEqual(q.x.filter((v) => !Number.isNaN(v)));
    const l = qqline(y);
    close(d.layers.line[0]!.y, l.intercept + l.slope * d.layers.line[0]!.x);
  });
  it("densityPlotData", () => {
    const d = densityPlotData([1, 2, 2.5, 4, 7]);
    const e = density([1, 2, 2.5, 4, 7]);
    expect(d.layers.curve.map((p) => p.y)).toEqual(e.y);
    expect(d.layers.rug.length).toBe(5);
    expect(d.meta.bw).toBe(e.bw);
  });
  it("boxplotData", () => {
    const d = boxplotData({ a: [1, 2, 3, 4, 40], b: [2, 3, 3, 5] });
    expect(d.layers.boxes.map((b) => b.group)).toEqual(["a", "b"]);
    expect(d.layers.outliers).toEqual([{ group: "a", y: 40 }]);
    const s = boxplotStats([2, 3, 3, 5]);
    expect([d.layers.boxes[1]!.lower, d.layers.boxes[1]!.median, d.layers.boxes[1]!.upper]).toEqual([s.stats[0], s.stats[2], s.stats[4]]);
    expect(boxplotData([1, 2, 3]).layers.boxes[0]!.group).toBe("");
  });
  it("ecdfPlotData and histPlotData", () => {
    const v = [3, 1, 2, 2, NaN];
    const F = ecdf(v);
    const s = ecdfPlotData(v).layers.steps;
    expect(s).toEqual([{ x: 1, y: 0.25 }, { x: 2, y: 0.75 }, { x: 3, y: 1 }]);
    for (const p of s) expect(F(p.x)).toBe(p.y);
    const h = hist([1, 2, 2, 3, 3, 3, 4]);
    const b = histPlotData([1, 2, 2, 3, 3, 3, 4]).layers.bars;
    expect(b.map((r) => r.count)).toEqual(h.counts);
    expect(histPlotData(h).layers.bars).toEqual(b);
  });
  it("rows to columns for Plotly with fromRows", () => {
    const cols = fromRows(ecdfPlotData([3, 1, 2]).layers.steps);
    expect(cols).toEqual({ x: [1, 2, 3], y: [1 / 3, 2 / 3, 1] });
  });
});

describe("model plots", () => {
  const x = [1, 2, 3, 4, 10, 6, 7], yv = [1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1];
  const fit = lm(x, yv);
  it("lmDiagnosticsData", () => {
    const d = lmDiagnosticsData(fit);
    expect(d.layers.residualsFitted.map((p) => p.y)).toEqual(fit.residuals);
    expect(d.layers.leverage.map((p) => p.x)).toEqual(lmHatvalues(fit));
    expect(d.layers.leverage.map((p) => p.cooks)).toEqual(lmCooksDistance(fit));
    expect(d.layers.qq.map((p) => p.y)).toEqual(lmRstandard(fit));
    const sm = lowess(fit.fittedValues, fit.residuals);
    expect(d.layers.residualsFittedSmooth.map((p) => p.y)).toEqual(sm.y);
    expect(d.layers.residualsFitted.filter((p) => p.extreme).length).toBe(3);
    // Cook's contour: D = level where r = sqrt(level p (1 - h) / h)
    const c = d.layers.cookContours.find((r) => r.level === 1 && r.side === 1)!;
    close((c.y * c.y * c.x) / ((1 - c.x) * fit.rank), 1);
  });
  it("lmDiagnosticsData with zero weights and leverage 1", () => {
    const w = lm(x, yv, { weights: [1, 1, 0, 1, 2, 1, 1] });
    const d = lmDiagnosticsData(w);
    expect(d.layers.residualsFitted.length).toBe(6);
    expect(d.layers.residualsFitted.map((p) => p.index)).toEqual([0, 1, 3, 4, 5, 6]);
    // a point of leverage 1 is left out of the standardized panels
    const g = lm([[1, 0], [2, 0], [3, 0], [4, 0], [5, 1]], [1, 2, 3.5, 4, 9]);
    const e = lmDiagnosticsData(g);
    expect(e.layers.residualsFitted.length).toBe(5);
    expect(e.layers.leverage.length).toBe(4);
  });
  it("coefPlotData and predictionBandData", () => {
    const c = coefPlotData(fit).layers.coefficients;
    expect(c.map((r) => r.term)).toEqual(["(Intercept)", "x1"]);
    expect(c[1]!.estimate).toBe(fit.coefficients[1]);
    expect(coefPlotData(fit, { intercept: false }).layers.coefficients.length).toBe(1);
    const b = predictionBandData(fit, [1, 5, 10]).layers.band;
    for (const r of b) {
      expect(r.predLower).toBeLessThan(r.confLower);
      expect(r.predUpper).toBeGreaterThan(r.confUpper);
    }
  });
  it("acfPlotData and forecastPlotData", () => {
    const s = [1, 3, 2, 5, 4, 6, 5, 8, 7, 9, 8, 10];
    const a = acf(s);
    const d = acfPlotData(a);
    expect(d.layers.bars.map((r) => r.acf)).toEqual(a.acf);
    close(d.meta.clim as number, qnorm(0.975) / Math.sqrt(12));
    const fc = forecast(arima(s, { order: [1, 0, 0] }), { h: 3 });
    const f = forecastPlotData(s, fc, { start: 2000, frequency: 4 });
    expect(f.layers.mean.map((r) => r.x)).toEqual([2003, 2003.25, 2003.5]);
    expect(f.layers.intervals.slice(0, 3).map((r) => r.level)).toEqual([95, 95, 95]);
    expect(f.layers.intervals[0]!.lower).toBe(fc.lower[0]![1]);
  });
});

describe("dendrogramData and biplotData", () => {
  for (const [method, e] of Object.entries(fx.dendrogram as Record<string, any>)) {
    it(`merges centred as R's dendrogram midpoints (${method})`, () => {
      const pts = [1, 2, 6, 7, 15, 16.5, 30, 3.5].map((v) => [v]);
      const hc = hclust(dist(pts), { method: method as "complete" });
      expect(hc.order).toEqual(e.order);
      const d = dendrogramData(hc);
      // R: x = the position of the node's leftmost leaf + midpoint, leaves at 1..n in order
      const pos = new Map((e.order as number[]).map((o, k) => [o, k + 1]));
      const expected = (e.nodes as any[]).map((n) => ({ x: pos.get(n.leaves[0])! + n.midpoint, y: n.height }));
      const got = d.layers.nodes.map((n) => ({ x: n.x, y: n.y }));
      const key = (p: { x: number; y: number }) => `${p.y}:${p.x}`;
      expect(got.map(key).sort()).toEqual(expected.map(key).sort());
      expect(d.layers.leaves.map((l) => l.x)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(d.layers.segments.length).toBe(3 * 7);
    });
  }
  it("hang", () => {
    const hc = hclust(dist([[1], [2], [6], [7], [15]]));
    const span = Math.max(...hc.height) - Math.min(...hc.height);
    const d = dendrogramData(hc);
    const leaf = d.layers.leaves.find((l) => l.index === 1)!;
    close(leaf.y, hc.height[0]! - 0.1 * span);
    expect(dendrogramData(hc, { hang: -1 }).layers.leaves.every((l) => l.y === 0)).toBe(true);
  });
  it("biplotData scaling (?biplot.prcomp)", () => {
    const X = [[1, 2], [2, 3.5], [3, 3], [4, 6], [5, 5.5]];
    const p = prcomp(X);
    const n = X.length;
    const d = biplotData(p);
    const lam = p.sdev.map((s) => s * Math.sqrt(n));
    close(d.layers.observations[0]!.x, p.x[0]![0]! / lam[0]!);
    close(d.layers.variables[1]!.y, p.rotation[1]![1]! * lam[1]!);
    const z = biplotData(p, { scale: 0 });
    close(z.layers.observations[0]!.x, p.x[0]![0]!);
    const g = biplotData(p, { pcBiplot: true });
    close(g.layers.observations[0]!.x, p.x[0]![0]! / p.sdev[0]!);
    expect(() => biplotData(p, { choices: [1, 3] })).toThrow(RangeError);
  });
});
