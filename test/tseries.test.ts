// tseries' tests against R (test/fixtures/tseries.json from oracle/tseries.R; behaviour in oracle/tsmeta-behaviour.md,
// experiments/tsmeta120-log.md items 6-9, 14-15, 17-18, 94).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adfTest, jarqueBeraTest, kpssTest, poTest, ppTest, runsTest, terasvirtaTest, whiteTest, type TseriesTest } from "../src/entries/timeseries.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/tseries.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : v === null || v === undefined ? [] : [num(v)]);
const close = (a: number, e: number, tol: number): boolean => Math.abs(a - e) <= tol * Math.max(1, Math.abs(e));
const check = (o: TseriesTest, r: any, tol = 1e-10): string[] => {
  const bad: string[] = [];
  if (!close(o.statistic, num(r.statistic), tol)) bad.push(`statistic ${o.statistic} ${r.statistic}`);
  if (!close(o.pValue, num(r.p), tol)) bad.push(`p ${o.pValue} ${r.p}`);
  const pr = arr(r.parameter); const po = Array.isArray(o.parameter) ? o.parameter : [o.parameter];
  if (pr.length && (pr.length !== po.length || pr.some((v, i) => !close(po[i]!, v, 1e-12)))) bad.push(`parameter ${po} ${pr}`);
  return bad;
};

describe("tseries", () => {
  for (const [name, c] of Object.entries(fx.uni as Record<string, any>)) {
    it(name, () => {
      const y = arr(c.y); const sign = y.map((v) => v > [...y].sort((a, b) => a - b)[Math.floor((y.length - 1) / 2)]! + 0);
      const med = (() => { const s = [...y].sort((a, b) => a - b); const h = s.length / 2; return s.length % 2 ? s[Math.floor(h)]! : (s[h - 1]! + s[h]!) / 2; })();
      const above = y.map((v) => v > med); void sign;
      const runs: Record<string, () => TseriesTest> = {
        adf: () => adfTest(y), adf_expl: () => adfTest(y, { alternative: "explosive" }), adf_k2: () => adfTest(y, { k: 2 }), adf_k0: () => adfTest(y, { k: 0 }),
        kpss_level: () => kpssTest(y), kpss_trend: () => kpssTest(y, { null: "Trend" }), kpss_long: () => kpssTest(y, { lshort: false }),
        pp_alpha: () => ppTest(y), pp_tau: () => ppTest(y, { type: "Z(t_alpha)" }), pp_long: () => ppTest(y, { lshort: false }), pp_expl: () => ppTest(y, { alternative: "explosive", type: "Z(t_alpha)" }),
        jb: () => jarqueBeraTest(y),
        runs: () => runsTest(above), runs_less: () => runsTest(above, { alternative: "less" }), runs_greater: () => runsTest(above, { alternative: "greater" }),
        tera: () => terasvirtaTest(y), tera_F: () => terasvirtaTest(y, { type: "F" }), tera_l2: () => terasvirtaTest(y, { lag: 2 }), tera_noscale: () => terasvirtaTest(y, { scale: false }),
        white: () => whiteTest(y, { seed: 1 }), white_F: () => whiteTest(y, { seed: 7, type: "F" }), white_l2: () => whiteTest(y, { seed: 3, lag: 2, q: 6, qstar: 3 }),
      };
      const bad: string[] = [];
      for (const [k, run] of Object.entries(runs)) for (const b of check(run(), c[k], 1e-9)) bad.push(`${k}: ${b}`);
      expect(bad).toEqual([]);
    });
  }
  it("po.test", () => {
    const bad: string[] = [];
    (fx.po as any[]).forEach((c, i) => { for (const b of check(poTest(c.x as number[][], { demean: c.demean, lshort: c.lshort }), c.r)) bad.push(`${i}: ${b}`); });
    expect(bad).toEqual([]);
  });
});
