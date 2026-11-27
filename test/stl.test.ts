// stats' stl and supsmu, forecast's mstl, seasadj, nsdiffs and ocsb.test against R (test/fixtures/stl.json from
// oracle/stl.R).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mstl, nsdiffs, ocsbTest, seasadj, stl, supsmu, type StlOptions } from "../src/entries/timeseries.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/stl.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
const maxAbs = (a: readonly number[], e: readonly number[]): number => Math.max(0, ...a.map((v, i) => Math.abs(v - e[i]!)));
const range = (v: readonly number[]): number => Math.max(...v) - Math.min(...v);

const ARG: Record<string, keyof StlOptions> = {
  "s.window": "sWindow", "s.degree": "sDegree", "t.window": "tWindow", "t.degree": "tDegree", "l.window": "lWindow",
  "s.jump": "sJump", "t.jump": "tJump", "l.jump": "lJump", robust: "robust", inner: "inner", outer: "outer",
};

describe("stl (stats)", () => {
  for (const [name, c] of Object.entries(fx.stl as Record<string, any>)) {
    it(name, () => {
      const opts: Record<string, unknown> = { frequency: num(c.frequency) };
      for (const [k, v] of Object.entries(c.args as Record<string, unknown>)) opts[ARG[k]!] = typeof v === "string" || typeof v === "boolean" ? v : num(v);
      const x = arr(c.x); const r = stl(x, opts as unknown as StlOptions); const tol = 1e-10 * range(x);
      expect(maxAbs(r.seasonal, arr(c.seasonal))).toBeLessThan(tol);
      expect(maxAbs(r.trend, arr(c.trend))).toBeLessThan(tol);
      expect(maxAbs(r.remainder, arr(c.remainder))).toBeLessThan(tol);
      expect(maxAbs(r.weights, arr(c.weights))).toBeLessThan(1e-10);
      expect(r.win).toEqual(arr(c.win)); expect(r.deg).toEqual(arr(c.deg)); expect(r.jump).toEqual(arr(c.jump));
      expect([r.inner, r.outer]).toEqual([num(c.inner), num(c.outer)]);
    });
  }
});

describe("supsmu (stats)", () => {
  for (const [name, c] of Object.entries(fx.supsmu as Record<string, any>)) {
    it(name, () => {
      const x = arr(c.x), y = arr(c.y); const tol = 1e-10 * range(y);
      expect(maxAbs(supsmu(x, y).y, arr(c.cv))).toBeLessThan(tol);
      expect(maxAbs(supsmu(x, y, { bass: 5 }).y, arr(c.bass5))).toBeLessThan(tol);
      expect(maxAbs(supsmu(x, y, { span: 0.3 }).y, arr(c.span03))).toBeLessThan(tol);
    });
  }
});

describe("mstl and seasadj (forecast)", () => {
  for (const [name, c] of Object.entries(fx.mstl as Record<string, any>)) {
    it(name, () => {
      const x = arr(c.x); const f = num(c.frequency); const tol = 1e-10 * range(x);
      const d = mstl(x, { frequency: f });
      expect(maxAbs(d.trend, arr(c.trend))).toBeLessThan(tol);
      expect(maxAbs(d.remainder, arr(c.remainder))).toBeLessThan(tol);
      expect(maxAbs(seasadj(d), arr(c.seasadj))).toBeLessThan(tol);
      // robust on an odd length (R bug 19370 affects some even lengths)
      expect(maxAbs(mstl(arr(c.xodd), { frequency: f, robust: true }).trend, arr(c.robust_trend))).toBeLessThan(tol);
    });
  }
});

describe("nsdiffs and ocsb.test (forecast)", () => {
  it("120 series", () => {
    const bad: string[] = [];
    (fx.nsdiffs as any[]).forEach((r, i) => {
      const y = arr(r.y); const m = num(r.frequency);
      if (nsdiffs(y, { frequency: m }) !== num(r.seas)) bad.push(`${i} seas`);
      if (nsdiffs(y, { frequency: m, test: "ocsb" }) !== num(r.ocsb)) bad.push(`${i} ocsb`);
      const o = ocsbTest(y, { frequency: m });
      if (Math.abs(o.statistic - num(r.ocsb_stat)) > 1e-10 * Math.max(1, Math.abs(num(r.ocsb_stat)))) bad.push(`${i} stat ${o.statistic} ${r.ocsb_stat}`);
      if (Math.abs(o.critical - num(r.ocsb_crit)) > 1e-12) bad.push(`${i} crit`);
      const o2 = ocsbTest(y, { frequency: m, maxlag: 2 });
      if (Math.abs(o2.statistic - num(r.ocsb2_stat)) > 1e-10 * Math.max(1, Math.abs(num(r.ocsb2_stat)))) bad.push(`${i} stat2 ${o2.statistic} ${r.ocsb2_stat}`);
    });
    // nsdiffs(test = "ocsb") chooses ocsb.test's lag by AIC (maxlag 3). forecast compares lags 1..3 and uses one
    // lag fewer than the chosen one (an off-by-one, experiments/tsmeta120-log.md items 89-90); rStats.js compares
    // 0..3 and uses the chosen lag (the user's decision). The decisions differ in these 5 of 120, each explained by
    // that: 26 and 78 choose lag 0 (not a candidate in R), 46, 72 and 82 choose R's criterion's lag (R uses one less)
    expect(bad.slice(0, 20)).toEqual(["26 ocsb", "46 ocsb", "72 ocsb", "78 ocsb", "82 ocsb"]);
  });

  // The selection's criterion against R's (experiments/tsmeta120-nsdiffs-ocsb2/3.json: ocsb.test's lag.order for
  // AIC, BIC, AICc and maxlag 1..3 / 1..6). R reports c = L_R - 1 where L_R minimises the criterion over 1..maxlag on
  // the common sample; rStats.js minimises over 0..maxlag on the same sample, so its lag is L_R or 0. Tiny samples
  // (common rows <= maxlag + 3, where lm's handling of aliased columns matters) are left out.
  it("lag selection: the same criterion as R over 1..maxlag, plus lag 0", () => {
    const cases: { y: number[]; m: number; meth: "AIC" | "BIC" | "AICc"; ml: number; c: number }[] = [];
    const read = (f: string): any => JSON.parse(readFileSync(new URL(`../experiments/${f}`, import.meta.url), "utf8"));
    for (const r of read("tsmeta120-nsdiffs-ocsb3.json").rows) for (const meth of ["AIC", "BIC", "AICc"] as const) (r.choices[meth] as number[]).forEach((c, i) => cases.push({ y: r.y, m: r.m, meth, ml: i + 1, c }));
    for (const r of read("tsmeta120-nsdiffs-ocsb2.json").rows) for (const meth of ["AIC", "BIC", "AICc"] as const) for (let ml = 1; ml <= 3; ml++) { const c = r.choices[`${meth}_${ml}`]; if (c != null) cases.push({ y: r.y, m: r.m, meth, ml, c }); }
    let same = 0, zero = 0; const bad: string[] = [];
    for (const c of cases) {
      if (c.y.length - c.m - 1 - c.ml <= c.ml + 3) continue;
      const L = ocsbTest(c.y, { frequency: c.m, lagMethod: c.meth, maxlag: c.ml }).lagOrder;
      if (L === c.c + 1) same++; else if (L === 0) zero++; else bad.push(`${c.meth} m${c.m} n${c.y.length} maxlag ${c.ml}: R ${c.c}, rStats.js ${L}`);
    }
    expect(bad).toEqual([]);
    expect([same, zero]).toEqual([1343, 2044]);
  });
});
