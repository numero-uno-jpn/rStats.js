import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clogit } from "../src/entries/tests.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/match.json", import.meta.url), "utf8")) as Record<string, any>;
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number) : [Number(v)]);
const data = (key: string): Record<string, number[]> => fixture[key].value;
const cases: [string, () => { y: number[]; x: number[][]; s: number[] }][] = [
  ["pairs", () => { const d = data("clogit_pairs_data"); return { y: d.y!, x: d.tr!.map((t) => [t]), s: d.pair! }; }],
  ["pairs_x1", () => { const d = data("clogit_pairs_data"); return { y: d.y!, x: d.tr!.map((t, i) => [t, d.x1![i]!]), s: d.pair! }; }],
  ["m2", () => { const d = data("clogit_m2_data"); return { y: d.y!, x: d.tr!.map((t, i) => [t, d.age![i]!]), s: d.pair! }; }],
  ["infert", () => { const d = data("clogit_infert_data"); return { y: d.case!, x: d.spontaneous!.map((v, i) => [v, d.induced![i]!]), s: d.stratum! }; }],
];

describe("clogit against survival::clogit", () => {
  for (const method of ["exact", "approximate"] as const) {
    it(`matches R (${method})`, () => {
      const bad: string[] = [];
      const check = (label: string, a: number[], e: number[], tol = 1e-9): void => {
        if (a.length !== e.length) { bad.push(`${label}: length`); return; }
        a.forEach((v, i) => { const r = Math.abs(v - e[i]!) / Math.max(Math.abs(e[i]!), 1e-300); if (!(r <= tol || Math.abs(v - e[i]!) < 1e-14)) bad.push(`${label}[${i}]: ${v} vs ${e[i]}`); });
      };
      const all: [string, () => { y: number[]; x: number[][]; s: number[] }][] = [...cases,
        ["multi", () => { const d = data(`clogit_multi_data_${method}`); return { y: d.y!, x: d.x!.map((v) => [v]), s: d.s! }; }]];
      for (const [name, get] of all) {
        const { y, x, s } = get();
        const e = fixture[`clogit_${name}_${method}`].value;
        const fit = clogit(y, x, s, { method });
        const key = `${name}_${method}`;
        check(`${key}.coef`, fit.coefficients, arr(e.coef));
        check(`${key}.var`, fit.var.flat(), arr(e.var));
        check(`${key}.loglik`, fit.loglik, arr(e.loglik), 1e-12);
        check(`${key}.score`, [fit.score], arr(e.score));
        check(`${key}.wald`, [fit.wald], arr(e.wald));
        check(`${key}.se`, fit.se, arr(e.se));
        check(`${key}.lower`, fit.lower, arr(e.lower));
        check(`${key}.logtest`, [fit.logtest.statistic, fit.logtest.df, fit.logtest.pValue], arr(e.logtest));
        check(`${key}.sctest`, [fit.sctest.statistic, fit.sctest.df, fit.sctest.pValue], arr(e.sctest));
        // R's summary rounds the Wald statistic to 2 decimals (its p-value is from the unrounded one)
        check(`${key}.waldtest`, [Math.round(fit.waldtest.statistic * 100) / 100, fit.waldtest.df, fit.waldtest.pValue], arr(e.waldtest));
        if (fit.iter !== e.iter) bad.push(`${key}.iter ${fit.iter} vs ${e.iter}`);
        if (fit.n !== e.n || fit.nevent !== e.nevent) bad.push(`${key}.n`);
        if (fit.method !== e.method) bad.push(`${key}.method ${fit.method} vs ${e.method}`);
      }
      expect(bad).toEqual([]);
    });
  }
});
