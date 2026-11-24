import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { balTab, match, matchWeights, tableOneSmd } from "../src/entries/causal.js";
import { setSeed } from "../src/entries/distributions.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/match.json", import.meta.url), "utf8")) as Record<string, any>;
const covs: Record<string, string[]> = {
  sim: ["x1", "x2"], lalonde: ["age", "educ", "black", "married", "re74", "re75"], cat: ["c1", "c2"],
};
const num = (v: unknown): number => (v === "NA" ? NaN : Number(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
function close(out: string[], label: string, a: number, e: number, tol = 1e-12): void {
  if (Number.isNaN(e) && Number.isNaN(a)) return;
  const rel = e === 0 ? Math.abs(a) : Math.abs(a - e) / Math.abs(e);
  if (!(rel <= tol)) out.push(`${label}: ${a} vs ${e}`);
}

describe("matchWeights against cobalt::get.w", () => {
  it("gives R's weights whenever the pairs are R's", () => {
    const bad: string[] = [];
    for (const key of Object.keys(fixture).filter((k) => k.startsWith("baltab_sim_"))) {
      const [, set, est, m, cal] = /^baltab_(\w+?)_(ATT|ATE|ATC)_m(\d)_(nocal|cal[\d.]+)$/.exec(key)!;
      setSeed(1234);
      const fit = match(fixture.data[set!].tr, fixture.data[set!].X, { estimand: est as "ATT", M: Number(m),
        ...(cal === "nocal" ? {} : { caliper: Number(cal!.slice(3)) }) });
      if (JSON.stringify(matchWeights(fit)) !== JSON.stringify(fixture[key].value.weights)) bad.push(key);
    }
    expect(bad).toEqual([]);
  });
});

describe("balTab against cobalt::bal.tab (with R's weights)", () => {
  it("matches every difference, variance ratio and count", () => {
    const bad: string[] = [];
    let cases = 0;
    for (const key of Object.keys(fixture).filter((k) => k.startsWith("baltab_"))) {
      const [, set, est] = /^baltab_(\w+?)_(ATT|ATE|ATC)_/.exec(key)!;
      const d = fixture.data[set!];
      const covariates = Object.fromEntries(covs[set!]!.map((c) => [c, d[c].map(Number)]));
      for (const binary of ["std", "raw"] as const) {
        const e = fixture[key].value[binary];
        // the pairs of the sim data are R's: pass the match itself (weights, estimand, discarded units)
        const [, , , mm, cal] = /^baltab_(\w+?)_(ATT|ATE|ATC)_m(\d)_(nocal|cal[\d.]+)$/.exec(key)!;
        setSeed(1234);
        const fit = set === "sim" ? match(d.tr, d.X, { estimand: est as "ATT", M: Number(mm), ...(cal === "nocal" ? {} : { caliper: Number(cal!.slice(3)) }) }) : undefined;
        const b = fit === undefined ? balTab(d.tr, covariates, { weights: fixture[key].value.weights, estimand: est as "ATT", binary })
          : balTab(d.tr, covariates, { match: fit, binary });
        const obsLen = fit === undefined ? 5 : arr(e.obsControl).length;
        cases++;
        if (JSON.stringify(b.type) !== JSON.stringify(arr(e.type))) bad.push(`${key}.${binary}.type`);
        for (const f of ["diffUn", "diffAdj", "vRatioUn", "vRatioAdj"] as const) {
          arr(e[f]).forEach((v, i) => close(bad, `${key}.${binary}.${f}[${i}]`, b[f][i]!, num(v)));
        }
        // without the match object the Discarded row is not known (and Unmatched then includes it): sim cases only
        if (fit !== undefined) {
          if (JSON.stringify(b.observations.rows) !== JSON.stringify(e.obsRows)) bad.push(`${key}.obsRows`);
          arr(e.obsControl).slice(0, obsLen).forEach((v, i) => close(bad, `${key}.obsControl[${i}]`, b.observations.control[i]!, num(v)));
          arr(e.obsTreated).slice(0, obsLen).forEach((v, i) => close(bad, `${key}.obsTreated[${i}]`, b.observations.treated[i]!, num(v)));
        }
      }
    }
    expect(bad).toEqual([]);
    expect(cases).toBeGreaterThan(40);
  });
});

describe("tableOneSmd against tableone::ExtractSmd", () => {
  it("matches the numeric and categorical SMDs", () => {
    const bad: string[] = [];
    for (const key of Object.keys(fixture).filter((k) => k.startsWith("tableone_"))) {
      const e = fixture[key].value;
      let data: Record<string, any>;
      let group: number[];
      if (key.startsWith("tableone_post_")) {
        const set = key.split("_")[2]!;
        const rows = e.rows as number[];
        const half = rows.length / 2;
        data = Object.fromEntries(covs[set]!.map((c) => [c, rows.map((r) => fixture.data[set][c][r - 1])]));
        group = rows.map((_, i) => (i < half ? 1 : 0));
      } else if (key === "tableone_constant") { data = { v: [2, 2, 2, 2] }; group = [0, 0, 1, 1]; }
      else if (key === "tableone_na") { data = { v: [1, NaN, 3, 2, 5, 4] }; group = [0, 0, 0, 1, 1, 1]; }
      else { const set = key.split("_")[1]!; data = fixture.data[set]; group = data.tr; }
      const factors = new Set(arr(e.factorVars ?? []) as string[]);
      arr(e.vars).forEach((v, i) => close(bad, `${key}.${String(v)}`,
        tableOneSmd(data[v as string], group, { factor: factors.has(v as string) }), num(arr(e.smd)[i])));
    }
    expect(bad).toEqual([]);
  });
});
