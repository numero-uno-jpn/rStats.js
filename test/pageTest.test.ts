import { describe, expect, it } from "vitest";
import { pageTest } from "../src/htest/rankTests.js";
import { qnorm } from "../src/distributions/normal.js";
import { readFileSync } from "node:fs";

const m1 = [
  [3.4, 4.1, 4.8, 5.0],
  [2.9, 3.0, 3.8, 4.4],
  [3.1, 3.9, 3.7, 4.9],
  [2.5, 3.6, 4.0, 4.1],
  [3.0, 2.8, 4.5, 4.6],
];
const ties = [
  [1, 2, 2, 3],
  [1, 1, 2, 2],
  [2, 3, 3, 4],
  [1, 2, 3, 3],
  [4, 4, 4, 4],
  [1, 3, 2, 4],
];

const pageFixture = JSON.parse(readFileSync(new URL("./fixtures/page.json", import.meta.url), "utf8")) as Record<string, any>;

function rRng(seed: number): () => number {
  let s = seed >>> 0;
  for (let i = 0; i < 50; i++) s = (Math.imul(69069, s) + 1) >>> 0;
  const init = new Uint32Array(625);
  for (let i = 0; i < init.length; i++) {
    s = (Math.imul(69069, s) + 1) >>> 0;
    init[i] = s;
  }
  const state = init.slice(1);
  let index = 624;
  return () => {
    if (index >= 624) {
      for (let i = 0; i < 624; i++) {
        const y = (state[i]! & 0x80000000) | (state[(i + 1) % 624]! & 0x7fffffff);
        state[i] = (state[(i + 397) % 624]! ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      }
      index = 0;
    }
    let y = state[index++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return (y >>> 0) / 4294967296;
  };
}

describe("pageTest", () => {
  it("matches the three alternatives and every returned field of the primary fixture", () => {
    const cases = [
      ["two.sided", 3.48568501158668, 0.000490878644840285],
      ["greater", 3.48568501158668, 0.000245439322420142],
      ["less", 3.48568501158668, 0.99975456067758],
    ] as const;
    for (const [alternative, statistic, pValue] of cases) {
      const r = pageTest(m1, { alternative });
      expect(r.method).toBe("Page's ordered aligned rank sum test");
      expect(r.statisticName).toBe("z");
      expect(r.alternative).toBe(alternative);
      expect(r.estimate).toBe(148);
      expect(r.statistic).toBeCloseTo(statistic, 12);
      expect(r.pValue).toBeCloseTo(pValue, 12);
      expect(r.warnings).toEqual([]);
    }
  });

  it("matches all 84 seeded Page size and alternative fixture cases", () => {
    const uniform = rRng(19);
    const blocks = [2, 3, 4, 5, 8, 12, 20];
    const mismatches: string[] = [];
    for (let k = 3; k <= 8; k++) {
      for (const n of blocks) {
        const values = Array.from({ length: n * k }, (_, i) =>
          Math.round((qnorm(uniform()) + (Math.floor(i / n) + 1) / 3) * 100) / 100);
        const matrix = Array.from({ length: n }, (_, row) =>
          Array.from({ length: k }, (_, col) => values[col * n + row]!));
        for (const [suffix, alternative] of [["", "two.sided"], ["_greater", "greater"]] as const) {
          const key = `page_size_k${k}_n${n}${suffix}`;
          const expected = pageFixture[key].value;
          const actual = pageTest(matrix, { alternative });
          const close = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
          if (actual.method !== expected.method) mismatches.push(`${key}.method`);
          if (actual.statisticName !== expected.statisticNames) mismatches.push(`${key}.statisticName`);
          if (actual.alternative !== expected.alternative) mismatches.push(`${key}.alternative`);
          const statistic = Array.isArray(actual.statistic) ? actual.statistic[0]! : actual.statistic;
          if (!close(statistic, expected.statistic)) mismatches.push(`${key}.statistic`);
          if (!close(actual.pValue, expected["p.value"])) mismatches.push(`${key}.p.value`);
          if (!close(actual.estimate!, expected.estimate)) mismatches.push(`${key}.estimate`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches ties, a single block and two treatments", () => {
    const r = pageTest(ties);
    expect(r.estimate).toBe(171.5);
    expect(r.statistic).toBeCloseTo(2.9698484809835, 12);
    expect(r.pValue).toBeCloseTo(0.00297946665633299, 12);
    const greater = pageTest(ties, { alternative: "greater" });
    expect(greater.pValue).toBeCloseTo(0.00148973332816649, 12);
    const one = pageTest([[1, 2, 3, 4]]);
    expect(one.estimate).toBe(30);
    expect(one.statistic).toBeCloseTo(1.55884572681199, 12);
    const two = pageTest([[1, 2], [3, 5], [2, 1], [4, 6]]);
    expect(two.estimate).toBe(19);
    expect(two.statistic).toBeCloseTo(0.5, 12);
  });

  it("orders vector treatments and blocks by R factor levels", () => {
    const x = m1.flatMap((_, i) => m1.map((row) => row[i]!));
    const groups = Array.from({ length: 4 }, (_, j) => Array(5).fill(j + 1)).flat();
    const blocks = Array.from({ length: 4 }, () => [1, 2, 3, 4, 5]).flat();
    const vector = pageTest(x, groups, blocks);
    expect(vector.estimate).toBe(148);
    expect(vector.statistic).toBeCloseTo(3.48568501158668, 12);
    const reversed = pageTest(m1.map((row) => row.slice().reverse()));
    expect(reversed.estimate).toBe(102);
    expect(reversed.statistic).toBeCloseTo(-3.64060434543497, 12);
    const reverseGroups = ["d", "c", "b", "a"].flatMap((g) => Array(5).fill(g));
    const factor = pageTest(x, reverseGroups, blocks);
    expect(factor.estimate).toBe(102);
    expect(factor.statistic).toBeCloseTo(-3.64060434543497, 12);
  });

  it("rejects incomplete blocks as selected, and rejects non-finite data", () => {
    const incomplete = m1.map((r) => [...r]);
    incomplete[1]![2] = NaN;
    expect(() => pageTest(incomplete)).toThrow(/missing or non-finite/);
    expect(() => pageTest([[1, 2], [3, Infinity]])).toThrow(/missing or non-finite/);
  });

  it("is invariant to scale and approximately invariant to translation", () => {
    const base = pageTest(m1);
    for (const scale of [1e100, 1e-100]) {
      const r = pageTest(m1.map((row) => row.map((v) => v * scale)));
      expect(r.statistic).toBeCloseTo(base.statistic, 12);
      expect(r.pValue).toBeCloseTo(base.pValue, 12);
    }
    const shifted = pageTest(m1.map((row) => row.map((v) => v + 1e8)));
    expect(shifted.statistic).toBeCloseTo(base.statistic, 7);
  });

  it("handles 100,000 two-treatment blocks", () => {
    const y = Array.from({ length: 100_000 }, (_, i) => [i % 7, (i * 3) % 11]);
    const start = performance.now();
    const r = pageTest(y);
    expect(Number.isFinite(r.statistic)).toBe(true);
    expect(Number.isFinite(r.pValue)).toBe(true);
    console.info(`pageTest 100,000 blocks: ${(performance.now() - start).toFixed(1)} ms`);
  });
});
