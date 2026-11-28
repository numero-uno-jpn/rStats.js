// meta's and netmeta's `level` sets only the study intervals; the pooled and prediction intervals use level.ma and
// level.predict, 0.95 by default whatever level is (experiments/plot121-log.md, experiments 4 and 5; R's values from
// experiments/plot121-metalevel.json and test/fixtures/plotdata.json). 1.20.0 took level as their default.
import { describe, expect, it } from "vitest";
import { metagen, metainc, metapropGlmm, netmeta, type TreatmentMatrix } from "../src/entries/tests.js";

const close = (a: number, b: number, tol = 1e-10) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const at = (m: TreatmentMatrix, i: string, j: string): number => m.values[m.rows.indexOf(i)]![m.cols.indexOf(j)]!;

describe("level, levelMa and levelPredict as meta and netmeta", () => {
  it("metagen", () => {
    const TE = [0.21, 0.52, -0.08, 0.35, 0.11, 0.62], seTE = [0.11, 0.21, 0.16, 0.12, 0.09, 0.3];
    const a = metagen(TE, seTE), b = metagen(TE, seTE, { level: 0.9 });
    for (const k of ["lower.common", "upper.random", "lower.predict"] as const) expect(b[k]).toBe(a[k]);
    expect(metagen(TE, seTE, { levelMa: 0.9 })["lower.common"]).toBeGreaterThan(a["lower.common"]);
  });
  it("metainc (MH, IRD)", () => {
    const e1 = [3, 5, 2, 8], t1 = [100, 120, 90, 200], e2 = [6, 9, 4, 10], t2 = [110, 100, 95, 210];
    const opt = { sm: "IRD", method: "MH" } as const;
    close(metainc(e1, t1, e2, t2, { ...opt, level: 0.9 })["lower.common"], -0.048389672882122224);
    close(metainc(e1, t1, e2, t2, { ...opt, levelMa: 0.9 })["lower.common"], -0.044146086563799536);
    close(metainc(e1, t1, e2, t2, { ...opt, level: 0.9 })["lower.random"], -0.045495549904174745);
  });
  it("metapropGlmm", () => {
    const ev = [4, 9, 12, 3, 7], n = [40, 50, 60, 35, 45];
    const a = metapropGlmm(ev, n), b = metapropGlmm(ev, n, { level: 0.9 });
    expect(b["lower.predict"]).toBe(a["lower.predict"]);
    expect(b["lower.common"]).toBe(a["lower.common"]);
    close(a["lower.predict"], -2.2273362961874543, 1e-5);
    close(metapropGlmm(ev, n, { levelPredict: 0.9 })["lower.predict"], -2.1090044177550551, 1e-5);
  });
  it("netmeta", () => {
    const f = (o = {}) => netmeta([0.3, 0.5, 0.2, 0.4, 0.1], [0.1, 0.2, 0.15, 0.2, 0.12], ["A", "A", "B", "A", "B"],
      ["B", "C", "C", "B", "C"], ["s1", "s2", "s3", "s4", "s5"], o);
    close(at(f({ level: 0.9 })["lower.common"], "A", "B"), 0.16328695388520062);
    close(at(f({ levelMa: 0.9 })["lower.common"], "A", "B"), 0.18941044300076784);
    close(at(f({ level: 0.9 })["lower.predict"], "A", "B"), 0.061939908855293324);
    close(at(f({ levelPredict: 0.9 })["lower.predict"], "A", "B"), 0.13067309017209019);
  });
});
