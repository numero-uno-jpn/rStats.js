// Edge cases of the IPTW functions (1.13.0): extreme scales of a covariate and of the weights, constant and aliased
// columns, non-convergence, ties in trim. R's own answers are in experiments/iptw113-edge.json; where R breaks down
// (tiny covariate scales, weights near 1e-200) rStats.js is checked for invariance instead.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { weightit, trimWeights, weightSummary, balTab, type WeightitMethod } from "../src/entries/causal.js";
import { svyglm, survfitCoxph, survfit } from "../src/entries/tests.js";

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

// The second round (experiments/iptw113-edge2.json, iptw113-edge3.json)
const e2 = JSON.parse(readFileSync(new URL("../experiments/iptw113-edge2.json", import.meta.url), "utf8")) as Record<string, any>;
const e3 = JSON.parse(readFileSync(new URL("../experiments/iptw113-edge3.json", import.meta.url), "utf8")) as Record<string, any>;
const d2 = e2.data;
const x2 = (a: number, b = 0) => d2.tr.map((t: number, i: number) => [t, d2.x1[i] * a + b]);

describe("trimWeights: R's reading of at", () => {
  const wv = [5, 1, 2, 9, 3, 4, 8, 6, 7, 10];
  it("gives R's weights for quantiles near 1 and below 0.5, and for counts up to the number of units", () => {
    for (const [o, re] of [[e2, /^trim_(.+)_(TRUE|FALSE)$/], [e3, /^trim_(.+)_(TRUE|FALSE)$/]] as const) {
      for (const k of Object.keys(o).filter((k) => re.test(k))) {
        const [, at, lo] = re.exec(k)!;
        expect(trimWeights(wv, { at: Number(at), lower: lo === "TRUE" }), k).toEqual(o[k].value);
      }
    }
  });
  it("does not trim, with R's warning, when at is as large as the trimmed group", () => {
    const w = weightit(d2.tr, { x1: d2.x1, x2: d2.x2 }, { estimand: "ATT" });
    for (const at of [48, 60]) {
      const t = trimWeights(w, { at, lower: true });
      expect(maxDiff(t.weights, e2[`trimATT_${at}`].value)).toBeLessThan(1e-14);
      expect(t.warnings).toEqual(["`at` must be less than 48, the number of units. Weights will not be trimmed."]);
    }
  });
});

describe("weightSummary: degenerate groups", () => {
  it("gives NaN (R's NA) where R does", () => {
    const one = weightSummary(weightit([1, 0, 0, 0, 0, 0, 0, 0, 0, 0], { x1: [0.3, -1, -0.5, 0, 0.2, 0.8, 1.1, -0.2, 0.4, 0.6] }));
    expect(one.treated.coefOfVar).toBeNaN();
    expect([one.treated.scaledMad, one.treated.negativeEntropy, one.treated.ess]).toEqual([0, 0, 1]);
    const zero = weightSummary({ weights: [0, 0, 0, 1, 2, 3], treat: [1, 1, 1, 0, 0, 0], stabilized: false } as any);
    for (const v of [zero.treated.coefOfVar, zero.treated.scaledMad, zero.treated.negativeEntropy, zero.treated.ess]) expect(v).toBeNaN();
    expect(zero.treated.numZeros).toBe(3);
    expect(zero.control.negativeEntropy).toBeCloseTo(e2.summary_zero_group.value["negative.entropy"].Control, 14);
  });
});

describe("weightit: scores at 0 and 1, and a large sample", () => {
  it("bounds glm's scores within [eps, 1 - eps] as R", () => {
    const sep = { tr: [0, 0, 0, 0, 1, 1, 1, 1], x1: [1, 2, 3, 4, 5, 6, 7, 8], x2: [0, 1, 0, 1, 1, 0, 1, 0] };
    const w = weightit(sep.tr, { x1: sep.x1, x2: sep.x2 });
    expect(maxDiff(w.ps!, e2.bal_separation.value.ps)).toBeLessThan(1e-12);
    expect(maxDiff(w.weights, e2.bal_separation.value.weights)).toBeLessThan(1e-12);
  });
  it("converges for n = 5000 with every method, R's weights", () => {
    const b = e2.big;
    for (const m of ["glm", "cbps", "ipt", "ebal"] as const) {
      const w = weightit(b.tr, { x1: b.x1, x2: b.x2, x3: b.x3 }, { method: m });
      expect(w.converged, m).toBe(true);
      expect(maxDiff(w.weights, e2[`big_${m}`].weights), m).toBeLessThan(1e-8);
    }
  });
});

describe("survfitCoxph: scales of the covariates and the times", () => {
  const nd = (a: number, b = 0) => [[0, 0.5 * a + b], [1, 0.5 * a + b]];
  const base = survfitCoxph(d2.time, d2.status, x2(1), { weights: d2.w, robust: true, newdata: nd(1) });
  it("gives R's curves where R works, and the same curves where R fails (covariates near 1e+-300)", () => {
    for (const k of ["cox_x1_off0_t1", "cox_x1e+150_off0_t1", "cox_x1_off0_t1e+300", "cox_x1_off0_t1e-300"]) {
      const [, a, , ts] = /^cox_x(.+)_off(.+)_t(.+)$/.exec(k)!.map(Number);
      const s = survfitCoxph(d2.time.map((t: number) => t * ts!), d2.status, x2(a!), { weights: d2.w, robust: true, newdata: nd(a!) });
      expect(maxDiff(s.surv.flat(), e2[k].value.surv), k).toBeLessThan(1e-12);
      expect(maxDiff(s.stdErr.flat(), e2[k].value["std.err"]), k).toBeLessThan(1e-12);
    }
    for (const a of [1e300, 1e-300]) {
      const s = survfitCoxph(d2.time, d2.status, x2(a), { weights: d2.w, robust: true, newdata: nd(a) });
      expect(maxDiff(s.surv.flat(), base.surv.flat())).toBeLessThan(1e-12);
      expect(maxDiff(s.stdErr.flat(), base.stdErr.flat())).toBeLessThan(1e-12);
    }
  });
  it("keeps the digits of a covariate with a large common offset (R loses them)", () => {
    const shifted = d2.x1.map((v: number) => v + 1e15), exact = shifted.map((v: number) => v - 1e15);
    const z = 0.5 + 1e15;
    const a = survfitCoxph(d2.time, d2.status, d2.tr.map((t: number, i: number) => [t, shifted[i]]), { weights: d2.w, robust: true, newdata: [[0, z], [1, z]] });
    const b = survfitCoxph(d2.time, d2.status, d2.tr.map((t: number, i: number) => [t, exact[i]]), { weights: d2.w, robust: true, newdata: [[0, z - 1e15], [1, z - 1e15]] });
    expect(maxDiff(a.surv.flat(), b.surv.flat())).toBeLessThan(1e-14);
    expect(maxDiff(a.stdErr.flat(), b.stdErr.flat())).toBeLessThan(1e-12);
  });
});

describe("survfit with fractional weights: their scale", () => {
  it("gives R's curves, and standard errors that scale as they should where R's overflow (1e-200)", () => {
    for (const rob of [true, false]) {
      const a = survfit(d2.time, d2.status, { group: d2.tr, weights: d2.w, robust: rob });
      const r = e2[`km_w1_${rob ? "default" : "FALSE"}`].value;
      expect(maxDiff(a.surv, r.surv)).toBeLessThan(1e-14);
      for (const sc of [1e200, 1e-200]) {
        const b = survfit(d2.time, d2.status, { group: d2.tr, weights: d2.w.map((v: number) => v * sc), robust: rob });
        expect(maxDiff(b.surv, a.surv)).toBeLessThan(1e-14);
        // the robust variance does not depend on the scale; Greenwood's (frequency weights) scales as 1 / scale
        const f = rob ? 1 : 1 / Math.sqrt(sc);
        b.stdErr.forEach((e, j) => { if (Number.isFinite(a.stdErr[j]!) && a.stdErr[j]! > 0) expect(Math.abs(e / (a.stdErr[j]! * f) - 1)).toBeLessThan(1e-12); });
      }
    }
  });
});

describe("svyglm: scales of x and y", () => {
  const base = svyglm(x2(1), d2.y, { weights: d2.w });
  it("gives R's answers where R works, and finite standard errors where the variance is out of range", () => {
    const r = e2["svy_gauss_x1e+150_off0"].value;
    const s = svyglm(x2(1e150), d2.y, { weights: d2.w });
    expect(maxDiff(s.coefficients, r.coef)).toBeLessThan(1e-12);
    expect(maxDiff(s.se, r.se)).toBeLessThan(1e-12);
    for (const a of [1e300, 1e-300]) {
      const t = svyglm(x2(a), d2.y, { weights: d2.w });
      expect(Math.abs(t.se[2]! * a / base.se[2]! - 1)).toBeLessThan(1e-12);
      expect(maxDiff(t.pValue, base.pValue)).toBeLessThan(1e-12);
    }
    const big = svyglm(x2(1), d2.y.map((v: number) => v * 1e300), { weights: d2.w }); // R: no valid set of coefficients
    big.se.forEach((v, j) => expect(Math.abs(v / 1e300 / base.se[j]! - 1)).toBeLessThan(1e-12));
    expect(maxDiff(big.pValue, base.pValue)).toBeLessThan(1e-12);
  });
});

describe("balTab: an SD below sqrt(eps), as cobalt", () => {
  it("uses the SD of the whole sample there, and the groups' SD above (an absolute threshold)", () => {
    const tr = [0, 0, 0, 0, 1, 1, 1, 1], w = [1, 2, 1, 1, 1, 1, 2, 1];
    const keys = Object.keys(e3).filter((k) => /^sd/.test(k));
    for (const k of keys) {
      const est = (/_(ATE|ATT|ATO)$/.exec(k)?.[1] ?? "ATE") as "ATE";
      const r = e3[k].value;
      const b = balTab(tr, { z: r.z }, { weights: w, estimand: est });
      const near = (a: number, x: number) => Math.abs(a - x) <= 1e-9 * Math.max(1, Math.abs(x));
      expect(near(b.diffUn[0]!, r.diffUn), `${k} un ${b.diffUn[0]} ${r.diffUn}`).toBe(true);
      expect(near(b.diffAdj[0]!, r.diffAdj), `${k} adj ${b.diffAdj[0]} ${r.diffAdj}`).toBe(true);
    }
    expect(keys.length).toBe(33);
  });
  it("gives R's prop.score row for separated data", () => {
    const sep = { tr: [0, 0, 0, 0, 1, 1, 1, 1], x1: [1, 2, 3, 4, 5, 6, 7, 8], x2: [0, 1, 0, 1, 1, 0, 1, 0] };
    const b = balTab(sep.tr, { x1: sep.x1, x2: sep.x2 }, { weightit: weightit(sep.tr, { x1: sep.x1, x2: sep.x2 }), binary: "std" });
    const r = e2.bal_separation.value;
    expect(b.rows).toEqual(r.rows);
    b.diffUn.forEach((v, i) => expect(Math.abs(v - r.diffUn[i])).toBeLessThan(1e-9));
    b.diffAdj.forEach((v, i) => expect(Math.abs(v - r.diffAdj[i])).toBeLessThan(1e-9));
  });
});
