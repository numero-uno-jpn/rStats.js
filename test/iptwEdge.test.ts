// Edge cases of the IPTW functions (1.13.0): extreme scales of a covariate and of the weights, constant and aliased
// columns, non-convergence, ties in trim. R's own answers are in experiments/iptw113-edge.json; where R breaks down
// (tiny covariate scales, weights near 1e-200) rStats.js is checked for invariance instead.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { weightit, trimWeights, balTab, type WeightitMethod } from "../src/entries/causal.js";
import { svyglm, survfitCoxph } from "../src/entries/tests.js";

const edge = JSON.parse(readFileSync(new URL("../experiments/iptw113-edge.json", import.meta.url), "utf8")) as Record<string, any>;
const md = edge.mild;
const methods: [WeightitMethod, "logit" | "probit" | undefined][] = [["glm", "logit"], ["cbps", "logit"], ["cbps", "probit"], ["ipt", "logit"], ["ebal", undefined]];
const opts = (m: WeightitMethod, l: string | undefined) => ({ method: m, ...(l === undefined ? {} : { link: l as "logit" }) });
const maxDiff = (a: readonly number[], b: readonly number[]): number => {
  const top = Math.max(...b.map(Math.abs));
  return Math.max(...a.map((v, i) => Math.abs(v - b[i]!) / top));
};

describe("weightit: scales and columns", () => {
  it("does not depend on the scale of a covariate (R's cbps, ipt and ebal break down below 1e-150)", () => {
    for (const [m, l] of methods) {
      const base = weightit(md.tr, { x1: md.x1, x2: md.x2, x3: md.x3 }, opts(m, l)).weights;
      for (const a of [1e150, 1e-150, 1e-300, 2 ** 1000]) {
        const w = weightit(md.tr, { x1: md.x1.map((v: number) => v * a), x2: md.x2, x3: md.x3 }, opts(m, l)).weights;
        expect(maxDiff(w, base), `${m} ${l} x${a}`).toBeLessThan(1e-9);
      }
    }
  });
  it("keeps the digits of a covariate with a large common offset", () => {
    const shifted = md.x1.map((v: number) => v + 1e15);
    const exact = shifted.map((v: number) => v - 1e15); // exact (Sterbenz): the same rounded data without the offset
    for (const [m, l] of methods) {
      const a = weightit(md.tr, { x1: shifted, x2: md.x2 }, opts(m, l)).weights;
      const b = weightit(md.tr, { x1: exact, x2: md.x2 }, opts(m, l)).weights;
      expect(maxDiff(a, b), `${m} ${l}`).toBeLessThan(1e-9);
    }
  });
  it("leaves out constant and aliased columns, as R's fit", () => {
    for (const [m, l] of methods) {
      const base = weightit(md.tr, { x1: md.x1, x2: md.x2 }, opts(m, l));
      const k = weightit(md.tr, { x1: md.x1, k: md.tr.map(() => 5), x2: md.x2, x2b: md.x2.map((v: number) => 3 - 2 * v) }, opts(m, l));
      expect(k.converged).toBe(true);
      expect(maxDiff(k.weights, base.weights), `${m} ${l}`).toBeLessThan(1e-9);
    }
    // R's answers with a constant covariate (glm and ebal keys are unique in the experiment)
    expect(maxDiff(weightit(md.tr, { x1: md.x1, k: md.tr.map(() => 5) }).weights, edge.const_glm.value.weights)).toBeLessThan(1e-12);
    expect(maxDiff(weightit(md.tr, { x1: md.x1, k: md.tr.map(() => 5) }, { method: "ebal" }).weights, edge.const_ebal.value.weights)).toBeLessThan(1e-8);
  });
  it("warns, as R, when the balance conditions have no solution, and still returns weights", () => {
    const h = edge.hard;
    const unwrap = (v: unknown): string[] => ([] as string[]).concat((v as string[]) ?? []).map((s) => s.replace(/\s*\n\s*/g, " "));
    const c = weightit(h.tr, { x1: h.x1, x2: h.x2, x3: h.x3 }, { method: "cbps", estimand: "ATC" });
    expect(c.converged).toBe(false);
    expect(unwrap(edge.hard_cbps_logit_ATC.warnings)[0]!.startsWith(c.warnings[0]!)).toBe(true);
    const e = weightit(h.tr, { x1: h.x1, x2: h.x2, x3: h.x3 }, { method: "ebal", estimand: "ATT" });
    expect(e.converged).toBe(false);
    expect(unwrap(edge.hard_ebal_none_ATT.warnings)[0]).toBe(e.warnings[0]);
    const i = weightit(h.tr, { x1: h.x1, x2: h.x2, x3: h.x3 }, { method: "ipt", estimand: "ATT" });
    expect(i.converged).toBe(false);
    expect(unwrap(edge.hard_ipt_logit_ATT.warnings)).toContain(i.warnings[0]);
    // where R converges on these data, rStats.js gives its weights
    for (const [m, l, est] of [["glm", "logit", "ATE"], ["cbps", "logit", "ATE"], ["cbps", "probit", "ATO"], ["ebal", undefined, "ATE"]] as const) {
      const w = weightit(h.tr, { x1: h.x1, x2: h.x2, x3: h.x3 }, { ...opts(m, l), estimand: est }).weights;
      expect(maxDiff(w, edge[`hard_${m}_${l ?? "none"}_${est}`].value.weights), `${m} ${est}`).toBeLessThan(1e-8);
    }
  });
});

describe("trimWeights: ties", () => {
  it("gives R's results for equal and tied weights", () => {
    expect(trimWeights(new Array(10).fill(2), { at: 0.9, lower: true })).toEqual(edge.trim_equal.value);
    expect(trimWeights([1, 1, 1, 2, 2, 2, 3, 3, 3, 9], { at: 0.9, lower: true })).toEqual(edge.trim_ties.value);
  });
});

describe("downstream: the scale of the weights", () => {
  const x = md.tr.map((t: number, i: number) => [t, md.x1[i]]);
  it("svyglm and balTab do not depend on it (R's bal.tab stops at 1e-200)", () => {
    const base = svyglm(x, md.y, { weights: md.w, family: "quasibinomial" });
    const r = edge.wscale_1.svyglm.value;
    expect(maxDiff(base.coefficients, r.coef)).toBeLessThan(1e-12);
    expect(maxDiff(base.se, r.se)).toBeLessThan(1e-10);
    const b0 = balTab(md.tr, { x1: md.x1, x2: md.x2 }, { weights: md.w, estimand: "ATE", binary: "std" }).diffAdj;
    for (const sc of [1e200, 1e-200, 2 ** -1000]) {
      const w = md.w.map((v: number) => v * sc);
      const s = svyglm(x, md.y, { weights: w, family: "quasibinomial" });
      expect(maxDiff(s.coefficients, base.coefficients)).toBeLessThan(1e-12);
      expect(maxDiff(s.se, base.se)).toBeLessThan(1e-10);
      expect(maxDiff(balTab(md.tr, { x1: md.x1, x2: md.x2 }, { weights: w, estimand: "ATE", binary: "std" }).diffAdj, b0)).toBeLessThan(1e-12);
    }
  });
  it("survfitCoxph gives R's curves, and the same curves with finite errors for weights near 1e-200 (R's fit fails)", () => {
    const nd = [[0, 0], [1, 0]];
    const base = survfitCoxph(md.time, md.status, x, { weights: md.w, robust: true, newdata: nd });
    const r = edge.wscale_1.cox.value;
    expect(maxDiff(base.surv.flat(), r.surv)).toBeLessThan(1e-12);
    expect(maxDiff(base.stdErr.flat(), r["std.err"])).toBeLessThan(1e-9);
    for (const sc of [1e200, 1e-200]) {
      const s = survfitCoxph(md.time, md.status, x, { weights: md.w.map((v: number) => v * sc), robust: true, newdata: nd });
      expect(maxDiff(s.surv.flat(), base.surv.flat())).toBeLessThan(1e-8);
      expect(s.stdErr.flat().every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});
