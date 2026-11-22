import { describe, expect, it } from "vitest";
import { pageTest } from "../src/htest/rankTests.js";
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

function pageMatrixForEstimate(k: number, n: number, target: number): number[][] {
  const byScore = new Map<number, number[]>();
  const add = (ranks: number[]): void => {
    const score2 = Math.round(2 * ranks.reduce((s, rank, j) => s + (j + 1) * rank, 0));
    if (!byScore.has(score2)) byScore.set(score2, ranks.slice());
  };
  const perm = Array.from({ length: k }, (_, i) => i + 1);
  const visit = (pos: number): void => {
    if (pos === k) {
      add(perm);
      for (let j = 0; j < k - 1; j++) {
        if (Math.abs(perm[j]! - perm[j + 1]!) === 1) {
          const tied = perm.slice();
          tied[j] = tied[j + 1] = (perm[j]! + perm[j + 1]!) / 2;
          add(tied);
        }
      }
      return;
    }
    for (let i = pos; i < k; i++) {
      [perm[pos], perm[i]] = [perm[i]!, perm[pos]!];
      visit(pos + 1);
      [perm[pos], perm[i]] = [perm[i]!, perm[pos]!];
    }
  };
  visit(0);
  const scores = [...byScore.keys()];
  const target2 = Math.round(2 * target);
  const layers: Array<Map<number, { previous: number; score: number }>> = [new Map([[0, { previous: 0, score: 0 }]])];
  for (let row = 0; row < n; row++) {
    const next = new Map<number, { previous: number; score: number }>();
    for (const sum of layers[row]!.keys()) {
      for (const score of scores) {
        const value = sum + score;
        if (value <= target2 && !next.has(value)) next.set(value, { previous: sum, score });
      }
    }
    layers.push(next);
  }
  if (!layers[n]!.has(target2)) throw new Error(`No rank matrix for Page estimate ${target} (k=${k}, n=${n})`);
  const rows: number[][] = [];
  let sum = target2;
  for (let row = n; row > 0; row--) {
    const node = layers[row]!.get(sum)!;
    rows.unshift(byScore.get(node.score)!.slice());
    sum = node.previous;
  }
  return rows;
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

  it("matches all 84 Page size and alternative fixture cases", () => {
    const mismatches: string[] = [];
    for (let k = 3; k <= 8; k++) {
      for (const n of [2, 3, 4, 5, 8, 12, 20]) {
        const key = `page_size_k${k}_n${n}`;
        const expected = pageFixture[key].value;
        const matrix = pageMatrixForEstimate(k, n, expected.estimate);
        for (const [suffix, alternative] of [["", "two.sided"], ["_greater", "greater"]] as const) {
          const fixture = pageFixture[key + suffix].value;
          const actual = pageTest(matrix, { alternative });
          const close = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
          if (actual.method !== fixture.method) mismatches.push(`${key + suffix}.method`);
          if (actual.statisticName !== fixture.statisticNames) mismatches.push(`${key + suffix}.statisticName`);
          if (actual.alternative !== fixture.alternative) mismatches.push(`${key + suffix}.alternative`);
          const statistic = typeof actual.statistic === "number" ? actual.statistic : actual.statistic[0]!;
          if (!close(statistic, fixture.statistic)) mismatches.push(`${key + suffix}.statistic`);
          if (!close(actual.pValue, fixture["p.value"])) mismatches.push(`${key + suffix}.p.value`);
          const estimate = typeof actual.estimate === "number" ? actual.estimate : actual.estimate?.[0] ?? NaN;
          if (!close(estimate, fixture.estimate)) mismatches.push(`${key + suffix}.estimate`);
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
    const x = Array.from({ length: 4 }, (_, i) => m1.map((row) => row[i]!)).flat();
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
    expect(Array.isArray(shifted.statistic) ? shifted.statistic[0]! : shifted.statistic).toBeCloseTo(Array.isArray(base.statistic) ? base.statistic[0]! : base.statistic, 7);
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
