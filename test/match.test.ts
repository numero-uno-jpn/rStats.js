import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { match } from "../src/entries/causal.js";
import { setSeed, runif } from "../src/entries/distributions.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/match.json", import.meta.url), "utf8")) as Record<string, any>;
const arr = (v: unknown): number[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v.map(Number) : [Number(v)]);
const keys = Object.keys(fixture).filter((k) => /^match_(sim|lalonde|cat)_/.test(k));

function parse(key: string): { set: string; estimand: "ATT" | "ATE" | "ATC"; M: number; caliper?: number } {
  const [, set, est, m, cal] = /^match_(\w+?)_(ATT|ATE|ATC)_m(\d)_(nocal|cal[\d.]+)$/.exec(key)!;
  return { set: set!, estimand: est as "ATT", M: Number(m), ...(cal === "nocal" ? {} : { caliper: Number(cal!.slice(3)) }) };
}

describe("match against Matching::Match (ties = FALSE, replace = FALSE)", () => {
  const exact: string[] = [];
  const own: string[] = [];
  const mismatches: string[] = [];
  for (const key of keys) {
    const { set, estimand, M, caliper } = parse(key);
    const data = fixture.data[set];
    const expected = fixture[key].value;
    setSeed(1234);
    const fit = match(data.tr, data.X.map(Number), { estimand, M, ...(caliper === undefined ? {} : { caliper }) });
    const next = runif(1)[0]!;
    // pairs equal to R's when no tie set had more than two candidates (rule 2 of oracle/match-behaviour.md)
    const rLike = fit.tieSizes.every((k) => k === 2);
    if (expected.notMatched) { if (fit.indexTreated.length !== 0) mismatches.push(`${key}: R found no match`); continue; }
    if (expected.ecaliper !== null && expected.ecaliper !== undefined &&
      Math.abs(fit.ecaliper! - expected.ecaliper) > 1e-15 * Math.abs(expected.ecaliper)) mismatches.push(`${key}.ecaliper`);
    if (fit.nobs !== expected.nobs) mismatches.push(`${key}.nobs`);
    if (rLike) {
      exact.push(key);
      for (const [f, a, e] of [["indexTreated", fit.indexTreated, expected["index.treated"]],
        ["indexControl", fit.indexControl, expected["index.control"]], ["weights", fit.weights, expected.weights],
        ["indexDropped", fit.indexDropped, expected["index.dropped"]]] as const) {
        if (JSON.stringify(arr(a)) !== JSON.stringify(arr(e))) mismatches.push(`${key}.${f}`);
      }
      if (fit.wnobs !== expected.wnobs) mismatches.push(`${key}.wnobs ${fit.wnobs} ${expected.wnobs}`);
      if (fit.ndrops !== expected.ndrops) mismatches.push(`${key}.ndrops`);
      if (fit.tieSizes.length !== expected.uniformDraws / 1 && fit.tieSizes.length * 1 !== expected.uniformDraws) {
        mismatches.push(`${key}: ${fit.tieSizes.length} draws, R ${expected.uniformDraws}`);
      }
      if (next !== expected.nextUniform) mismatches.push(`${key}: the random numbers after the call differ`);
    } else {
      own.push(key);
      // own tie-breaking: the structure must still hold
      const pairs = fit.indexTreated.length;
      if (pairs !== fit.wnobs * M) mismatches.push(`${key}: pairs != wnobs * M`);
      if (fit.wnobs + fit.ndrops !== (estimand === "ATT" ? data.tr.filter((t: number) => t === 1).length
        : estimand === "ATC" ? data.tr.filter((t: number) => t === 0).length : data.tr.length)) mismatches.push(`${key}: wnobs + ndrops`);
    }
  }
  it("matches R's pairs and random numbers whenever the ties are R's", () => {
    expect(mismatches).toEqual([]);
    expect(exact.length).toBeGreaterThanOrEqual(36);
  });
});

describe("match: inputs", () => {
  it("rejects what R rejects", () => {
    expect(() => match([0, 1, 2, 0], [1, 2, 3, 4])).toThrow(/logical variable/);
    expect(() => match([0, 1, 1, 0], [1, NaN, 3, 4])).toThrow(/NAs/);
    expect(() => match([1, 1, 1], [1, 2, 3])).toThrow(/both treatment and control/);
    expect(() => match([0, 1, 1], [1, 2, 3, 4])).toThrow(/length/);
    expect(() => match([0, 1, 1, 0], [1, 2, 3, 4], { M: 0 })).toThrow(/positive integer/);
  });
  it("returns no pairs and R's warning when nothing is within the caliper", () => {
    setSeed(1234);
    const fit = match([1, 1, 0, 0], [0, 0.1, 5, 5.1], { caliper: 0.01 });
    expect(fit.indexTreated).toEqual([]);
    expect(fit.warnings).toEqual([fixture.match_none_within_caliper.warnings]);
  });
});
