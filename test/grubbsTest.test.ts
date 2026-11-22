import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { grubbsTest, pgrubbs, qgrubbs } from "../src/htest/grubbs.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/grubbs.json", import.meta.url), "utf8")) as Record<string, any>;
const samples = {
  x1: [199.31, 199.53, 200.19, 200.82, 201.92, 201.95, 202.18, 245.57],
  x2: [-3.1, 0.2, 0.4, 0.5, 0.7, 0.9, 1.1, 1.2, 1.3, 4.8],
  x3: [8.1, 8.3, 8.4, 8.6, 8.8, 9.0, 9.1, 12.4, 12.9],
};

function num(v: number | string): number {
  return v === "NaN" || v === "NA" ? NaN : v === "Inf" ? Infinity : Number(v);
}
function close(actual: number, expected: number, label: string, mismatches: string[]): void {
  const e = num(expected);
  const ok = Number.isNaN(e) ? Number.isNaN(actual) : actual === e ||
    (Number.isFinite(actual) && Number.isFinite(e) && Math.abs(actual - e) <= 1e-12 * Math.max(Math.abs(e), 1e-300));
  if (!ok) mismatches.push(`${label}: expected ${e}, got ${actual}`);
}

describe("Grubbs type 10", () => {
  it("matches all 12 type-10 fixture calls for each of the three samples", () => {
    const mismatches: string[] = [];
    for (const [name, x] of Object.entries(samples)) {
      for (const opposite of [false, true]) for (const twoSided of [false, true]) {
        const key = `grubbs_${name}_type10_opp${Number(opposite)}_two${Number(twoSided)}`;
        const expected = fixture[key].value;
        const actual = grubbsTest(x, { opposite, twoSided });
        if (actual.method !== expected.method) mismatches.push(`${key}.method`);
        if (JSON.stringify(actual.statisticName) !== JSON.stringify(expected.statisticNames)) mismatches.push(`${key}.statisticNames`);
        if (actual.alternative !== expected.alternative) mismatches.push(`${key}.alternative: ${actual.alternative}`);
        close(actual.statistic[0], expected.statistic[0], `${key}.G`, mismatches);
        close(actual.statistic[1], expected.statistic[1], `${key}.U`, mismatches);
        close(actual.pValue, expected["p.value"], `${key}.p`, mismatches);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches every type-10 pgrubbs and qgrubbs fixture value", () => {
    const mismatches: string[] = [];
    for (const n of [3, 4, 5, 7, 10, 20, 30, 50]) {
      const pcase = fixture[`pgrubbs_type10_n${n}`];
      const pgot0 = pgrubbs(pcase.q, n);
      const pgot = typeof pgot0 === "number" ? [pgot0] : Array.from(pgot0);
      pcase.p.forEach((entry: any, i: number) => close(pgot[i]!, entry.value, `pgrubbs n=${n} q=${pcase.q[i]}`, mismatches));
      const qcase = fixture[`qgrubbs_type10_n${n}`];
      const qgot0 = qgrubbs(qcase.p, n);
      const qgot = typeof qgot0 === "number" ? [qgot0] : Array.from(qgot0);
      qcase.q.forEach((entry: any, i: number) => close(qgot[i]!, entry.value, `qgrubbs n=${n} p=${qcase.p[i]}`, mismatches));

    }
    expect(mismatches).toEqual([]);
  });

  it("omits NA, rejects infinities, and applies the selected constant-data choice", () => {
    const r = grubbsTest([1, 2, NaN, 3, 10]);
    expect(r.statistic[0]).toBeCloseTo(1.46969384566991, 12);
    expect(r.statistic[1]).toBeCloseTo(0.04, 12);
    expect(r.pValue).toBeCloseTo(0.0404082057734576, 12);
    expect(() => grubbsTest([1, 2, Infinity, 3])).toThrow(/finite/);
    const constant = grubbsTest([3, 3, 3, 3, 3, 3]);
    expect(Number.isNaN(constant.statistic[0])).toBe(true);
    expect(Number.isNaN(constant.statistic[1])).toBe(true);
    expect(Number.isNaN(constant.pValue)).toBe(true); // choice: constant samples have p = NaN, not R's p = 0
  });

  it("matches the remaining supported type-10 boundary fixtures", () => {
    const cases = [
      ["grubbs_n2", [1, 2], {}],
      ["grubbs_n3", [1, 2, 10], {}],
      ["grubbs_tie_extremes", [1, 1, 2, 3, 4, 9, 9], {}],
      ["grubbs_symmetric", [-5, 0, 0.1, -0.1, 0.2, -0.2, 5], {}],
      ["grubbs_large_n", [...Array.from({ length: 199 }, (_, i) => -2 + (4 * i) / 198), 6], {}],
    ] as const;
    const mismatches: string[] = [];
    for (const [key, x, options] of cases) {
      const expected = fixture[key].value;
      const actual = grubbsTest(x, options);
      close(actual.statistic[0], expected.statistic[0], `${key}.G`, mismatches);
      close(actual.statistic[1], expected.statistic[1], `${key}.U`, mismatches);
      close(actual.pValue, expected["p.value"], `${key}.p`, mismatches);
      if (actual.alternative !== expected.alternative) mismatches.push(`${key}.alternative`);
    }
    expect(mismatches).toEqual([]);
    expect(grubbsTest([1, 2]).warnings).toEqual(["NaNs produced"]);
  });

  it("rejects unsupported types 11 and 20 with the type in the error", () => {
    expect(() => grubbsTest([1, 2, 3, 4], { type: 11 })).toThrow(/type 11/);
    expect(() => grubbsTest([1, 2, 3, 4], { type: 20 })).toThrow(/type 20/);
    expect(() => pgrubbs(1, 5, 11)).toThrow(/type 11/);
    expect(() => qgrubbs(0.5, 5, 20)).toThrow(/type 20/);
  });

  it("is scale invariant and robust to a large translation", () => {
    const x = samples.x1;
    const base = grubbsTest(x);
    for (const scale of [1e100, 1e-100]) {
      const r = grubbsTest(x.map((v) => v * scale));
      expect(r.statistic[0]).toBeCloseTo(base.statistic[0], 12);
      expect(r.statistic[1]).toBeCloseTo(base.statistic[1], 12);
    }
    const shifted = grubbsTest(samples.x2.map((v) => v + 1e8));
    expect(shifted.statistic[0]).toBeCloseTo(grubbsTest(samples.x2).statistic[0], 6);
  });

  it("handles 100,000 observations", () => {
    const x = Array.from({ length: 100_000 }, (_, i) => Math.sin(i * 0.17) + (i === 99_999 ? 10 : 0));
    const start = performance.now();
    const r = grubbsTest(x);
    expect(Number.isFinite(r.statistic[0])).toBe(true);
    expect(Number.isFinite(r.pValue)).toBe(true);
    console.info(`grubbsTest 100,000 rows: ${(performance.now() - start).toFixed(1)} ms`);
  });
});
