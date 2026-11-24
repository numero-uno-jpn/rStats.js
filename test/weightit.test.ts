import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { weightit, trimWeights, weightSummary, balTab, type WeightitEstimand, type WeightitMethod } from "../src/entries/causal.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/weightit.json", import.meta.url), "utf8")) as Record<string, any>;
const covs: Record<string, string[]> = {
  sim: ["x1", "x2", "x3"], lalonde: ["age", "educ", "race", "married", "nodegree", "re74", "re75"],
  veteran: ["karno", "age", "prior", "celltype"],
};
const covariates = (set: string): Record<string, number[] | string[]> =>
  Object.fromEntries(covs[set]!.map((c) => [c, fixture.data[set][c]]));
const relDiff = (a: readonly number[], b: readonly number[]): number =>
  Math.max(0, ...a.map((x, i) => Math.abs(x - b[i]!) / Math.max(Math.abs(b[i]!), 1e-300)));
// weights: the error relative to the largest weight of the unit's group (R bounds scores near 2.2e-16 and takes 1 - p, so
// weights below about 1e-13 of the largest carry no digits; experiments in oracle/weightit-behaviour.md)
const weightDiff = (a: readonly number[], b: readonly number[], tr: readonly number[]): number => {
  const top = [0, 1].map((g) => Math.max(...b.filter((_, i) => tr[i] === g)));
  return Math.max(0, ...a.map((x, i) => Math.abs(x - b[i]!) / top[tr[i]!]!));
};

interface Case { key: string; set: string; method: WeightitMethod; link: string | undefined; estimand: WeightitEstimand; stabilize: boolean }
const cases: Case[] = Object.keys(fixture).filter((k) => k.startsWith("w_")).map((key) => {
  const [, set, method, link, estimand, stab] = /^w_(\w+?)_(ps|glm|cbps|ipt|ebal)_(\w+?)_(ATE|ATT|ATC|ATO)(_stab)?$/.exec(key)!;
  return { key, set: set!, method: method as WeightitMethod, link: link === "none" ? undefined : link, estimand: estimand as WeightitEstimand, stabilize: stab !== undefined };
});
const fit = (c: Case) => weightit(fixture.data[c.set].tr, covariates(c.set), {
  method: c.method, estimand: c.estimand, stabilize: c.stabilize, ...(c.link === undefined ? {} : { link: c.link as "logit" }),
});
// glm's scores are R's to rounding; the balance-condition methods are solved exactly where R stops early (Choices 2)
const tolerance = (m: WeightitMethod): number => (m === "glm" || m === "ps" ? 1e-12 : 1e-6);

describe("weightit against WeightIt::weightit", () => {
  it("gives R's weights and propensity scores for every method, link and estimand", () => {
    const bad: string[] = [];
    for (const c of cases) {
      const e = fixture[c.key];
      if (e.error !== undefined) {
        try { fit(c); bad.push(`${c.key}: R failed (${e.error}) but rStats did not`); } catch { /* as R */ }
        continue;
      }
      const w = fit(c);
      const dw = weightDiff(w.weights, e.value.weights, fixture.data[c.set].tr);
      if (dw > tolerance(c.method)) bad.push(`${c.key}.weights ${dw.toExponential(2)}`);
      if (e.value.ps !== null && e.value.ps !== undefined) {
        // scores: relative to the score and to its complement (the precision R keeps near 1)
        const dp = Math.max(0, ...w.ps!.map((x, i) => Math.abs(x - e.value.ps[i]) / Math.max(Math.min(e.value.ps[i], 1 - e.value.ps[i]), 1e-12)));
        if (dp > tolerance(c.method)) bad.push(`${c.key}.ps ${dp.toExponential(2)}`);
      } else if (w.ps !== null) bad.push(`${c.key}: R has no ps`);
      if (w.method !== e.value.method) bad.push(`${c.key}.method ${w.method}`);
    }
    expect(bad).toEqual([]);
    expect(cases.length).toBeGreaterThan(90);
  });
});

describe("trimWeights against WeightIt::trim", () => {
  it("caps at R's type-3 quantile of the trimmed group, with and without lower", () => {
    const bad: string[] = [];
    const keys = Object.keys(fixture).filter((k) => /^trim_(sim|lalonde)_/.test(k));
    for (const key of keys) {
      const [, set, base, at, side] = /^trim_(sim|lalonde)_(\w+?)_([\d.]+)_(both|upper)$/.exec(key)!;
      const c = cases.find((x) => x.key === `w_${set}_${base}`)!;
      const t = trimWeights(fit(c), { at: Number(at), lower: side === "both" });
      const d = weightDiff(t.weights, fixture[key].value.weights, fixture.data[set!].tr);
      if (d > tolerance(c.method)) bad.push(`${key} ${d.toExponential(2)}`);
    }
    expect(bad).toEqual([]);
    expect(keys.length).toBe(120);
  });
  it("trims a vector of weights over all of it", () => {
    expect(trimWeights([5, 1, 2, 9, 3, 4, 8, 6, 7, 10], { at: 0.8, lower: true })).toEqual(fixture.trim_vector.value);
  });
});

describe("weightSummary against summary.weightit", () => {
  it("gives R's range, top weights, spread measures and effective sample sizes", () => {
    const bad: string[] = [];
    for (const c of cases) {
      const e = fixture[c.key];
      if (e.error !== undefined) continue;
      const s = weightSummary(fit(c)), r = e.value.summary;
      const tol = tolerance(c.method) * 10;
      const ess = r.ess.values as number[]; // Unweighted/Weighted x Control/Treated, by column
      for (const [g, part] of [["Treated", s.treated], ["Control", s.control]] as const) {
        const near = (a: number, b: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
        if (!near(part.range[0], r["weight.range"][g].values[0]) && !(r["weight.range"][g].values[0] < 1e-12)) bad.push(`${c.key} ${g} min`);
        if (!near(part.range[1], r["weight.range"][g].values[1])) bad.push(`${c.key} ${g} max`);
        if (!near(part.coefOfVar, r["coef.of.var"][g])) bad.push(`${c.key} ${g} cv`);
        if (!near(part.scaledMad, r["scaled.mad"][g])) bad.push(`${c.key} ${g} mad`);
        if (!near(part.negativeEntropy, r["negative.entropy"][g])) bad.push(`${c.key} ${g} entropy`);
        if (part.numZeros !== r["num.zeros"][g]) bad.push(`${c.key} ${g} zeros`);
        const col = g === "Control" ? 0 : 1;
        if (part.n !== ess[2 * col] || !near(part.ess, ess[2 * col + 1]!)) bad.push(`${c.key} ${g} ess`);
        const top = r["weight.top"][g];
        if (c.method === "glm" && JSON.stringify(part.top.index.map(String)) !== JSON.stringify(top.names)) bad.push(`${c.key} ${g} top ${part.top.index} ${top.names}`);
        if (r["weight.mean"] && !near(part.mean, r["weight.mean"][g])) bad.push(`${c.key} ${g} mean`);
      }
      if (s.stabilized !== (r["weight.mean"] !== null && r["weight.mean"] !== undefined)) bad.push(`${c.key} stabilized`);
    }
    expect(bad).toEqual([]);
  });
});

// R (cli) wraps long warnings at a line width
const unwrap = (m: string): string => m.replace(/\s*\n\s*/g, " ");

describe("weightit: inputs and warnings", () => {
  const sim = fixture.data.sim;
  it("rejects what R rejects, with R's messages", () => {
    expect(() => weightit(sim.tr, { x1: sim.x1 }, { estimand: "ATT", stabilize: true })).toThrow("`stabilize` can only be supplied when `estimand = \"ATE\"`.");
    expect(() => weightit(sim.tr, { x1: sim.x1 }, { method: "ipt", estimand: "ATO" })).toThrow(/"ATO" is not an allowable estimand for inverse probability tilting/);
    expect(() => weightit(sim.tr, { x1: sim.x1 }, { method: "ebal", estimand: "ATO" })).toThrow(/"ATO" is not an allowable estimand for entropy balancing/);
    expect(() => weightit([1, 1, 1, 1, 1], { x1: [1, 2, 3, 4, 5] })).toThrow("The treatment must have at least two unique values.");
    expect(() => weightit([0, 1, 0, 1, 1], { x1: [1, NaN, 3, 4, 5] })).toThrow(/missing/);
  });
  it("warns as R", () => {
    expect(weightit(sim.tr, { x1: sim.x1, x2: sim.x2 }, { method: "cbps", stabilize: true }).warnings).toEqual(([] as string[]).concat(fixture.warn_cbps_stab.warnings).map(unwrap));
    const sep = weightit([0, 0, 0, 0, 1, 1, 1, 1], { x1: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(sep.warnings).toEqual(([] as string[]).concat(fixture.warn_separation.warnings).map(unwrap));
  });
});

describe("balTab of a weightit result against cobalt::bal.tab", () => {
  it("gives R's rows, differences, variance ratios and effective sample sizes", () => {
    const bad: string[] = [];
    const keys = Object.keys(fixture).filter((k) => k.startsWith("bal_"));
    const num = (v: unknown): number => (v === "NA" || v === null ? NaN : Number(v));
    for (const key of keys) {
      const [, set, base] = /^bal_(sim|lalonde|veteran)_(.+)$/.exec(key)!;
      const c = cases.find((x) => x.key === `w_${set}_${base}`)!;
      const w = fit(c);
      const lev = fixture.levels[set!];
      for (const kind of ["std", "raw"] as const) {
        const e = fixture[key].value[kind];
        const b = balTab(fixture.data[set!].tr, covariates(set!), { weightit: w, levels: lev, ...(kind === "std" ? { binary: "std" } : {}) });
        if (JSON.stringify(b.rows) !== JSON.stringify(e.rows)) { bad.push(`${key}.${kind}.rows ${b.rows}`); continue; }
        if (JSON.stringify(b.type) !== JSON.stringify(e.type)) bad.push(`${key}.${kind}.type`);
        const tol = c.method === "glm" ? 1e-9 : 1e-5;
        for (const [f, a, r] of [["diffUn", b.diffUn, e.diffUn], ["diffAdj", b.diffAdj, e.diffAdj],
          ["vRatioUn", b.vRatioUn, e.vRatioUn], ["vRatioAdj", b.vRatioAdj, e.vRatioAdj]] as const) {
          if (kind === "raw" && f.startsWith("vRatio")) continue; // the default call shows no variance ratios
          (r as unknown[]).forEach((rv, i) => {
            const x = num(rv), y = a[i]!;
            // differences of exactly balanced covariates are 0 to rounding (absolute)
            const ok = Number.isNaN(x) ? Number.isNaN(y) : Math.abs(y - x) <= tol * Math.max(1, Math.abs(x));
            if (!ok) bad.push(`${key}.${kind}.${f}[${e.rows[i]}] ${y} vs ${x}`);
          });
        }
        if (JSON.stringify(b.observations.rows) !== JSON.stringify(e.obsRows)) bad.push(`${key}.obsRows`);
        [[b.observations.control, e.obsControl], [b.observations.treated, e.obsTreated]].forEach(([a, r]) =>
          (r as number[]).forEach((x, i) => { if (Math.abs(a![i]! - x) > tol * x) bad.push(`${key}.obs ${a![i]} vs ${x}`); }));
      }
    }
    expect(bad).toEqual([]);
    expect(keys.length).toBe(33);
  });
});
