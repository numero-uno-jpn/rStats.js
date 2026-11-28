// The examples of docs/plotting.md (the rStats.js parts; the drawing needs a browser): the values the page shows.
import { describe, expect, it } from "vitest";
import { fromRows, lm, metagen, survfit } from "../src/index.js";
import {
  boxplotData, densityPlotData, forestPlotData, funnelPlotData, lmDiagnosticsData, qqPlotData, survPlotData,
} from "../src/entries/plot.js";

describe("docs/plotting.md", () => {
  it("the shape and survival curves", () => {
    const time = [5, 8, 12, 12, 20, 3, 9, 9, 15, 22, 30, 4];
    const status = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1];
    const arm = ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b", "b"];
    const km = survPlotData(survfit(time, status, { group: arm }));
    expect(km.layers.steps[0]).toEqual({ x: 0, y: 1, ymin: 1, ymax: 1, group: "group=a" });
    expect(km.layers.censor[0]).toEqual({ x: 8, y: 0.8, group: "group=a", n: 1 });
    expect(km.layers.riskTable[2]).toEqual({ x: 10, group: "group=a", nRisk: 3 });
    expect(km.meta.groups).toEqual(["group=a", "group=b"]);
    const cols = fromRows(km.layers.steps);
    expect(Object.keys(cols)).toEqual(["x", "y", "ymin", "ymax", "group"]);
  });
  it("forest and funnel plots", () => {
    const m = metagen([0.21, 0.52, -0.08, 0.35, 0.11, 0.62], [0.11, 0.21, 0.16, 0.12, 0.09, 0.3]);
    const fp = forestPlotData(m, { labels: ["A", "B", "C", "D", "E", "F"], prediction: true });
    const s = fp.layers.studies[0]!;
    expect([s.label, s.y, s.estimate, s.se]).toEqual(["A", 6, 0.21, 0.11]);
    expect([s.lower.toFixed(4), s.upper.toFixed(4), s.weight.toFixed(2)]).toEqual(["-0.0056", "0.4256", "22.11"]);
    expect(fp.layers.pooled.map((p) => p.y)).toEqual([-1, -2, -3]);
    expect(funnelPlotData(m, { contours: [0.9, 0.95, 0.99] }).layers.contours.length).toBe(150);
  });
  it("distributions and model diagnostics", () => {
    const y = [3.1, 1.2, 5.5, 1.2, 9.0, 4.4, 6.3, 2.8];
    expect(qqPlotData(y).layers.line.length).toBe(2);
    expect(densityPlotData(y).layers.curve.length).toBe(512);
    expect(boxplotData({ a: y, b: [2, 3, 3, 5, 12] }).layers.outliers).toEqual([{ group: "b", y: 12 }]);
    const fit = lm([1, 2, 3, 4, 10, 6, 7], [1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1]);
    const diag = lmDiagnosticsData(fit);
    expect(Object.keys(diag.layers)).toEqual([
      "residualsFitted", "residualsFittedSmooth", "qq", "scaleLocation", "scaleLocationSmooth", "leverage",
      "leverageSmooth", "cookContours",
    ]);
  });
});
