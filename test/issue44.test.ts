// Issue #44: mixed numeric and string group labels are text, as R coerces them (review_fix_log_issue44.md).
import { describe, expect, it } from "vitest";
import { kruskalTest, onewayTest, pairwiseTTest, pairwiseWilcoxTest } from "../src/index.js";
import { labelledGroups } from "../src/htest/groups.js";

const x = [1, 2, 10, 11, 20, 21, 30, 31];
const g = [2, 2, "2", "2", 10, 10, "10", "10"];

describe("issue #44", () => {
  it("makes 2 and \"2\" one group, ordered as text (R 4.5.2)", () => {
    // there were four groups labelled "2", "10", "10", "2"
    expect(labelledGroups(x, g)).toEqual({ labels: ["10", "2"], groups: [[20, 21, 30, 31], [1, 2, 10, 11]] });
    const o = onewayTest(x, g);
    expect(o.statistic).toBeCloseTo(24.9344262295081975, 12);
    expect(o.parameter[0]).toBe(1);
    expect(o.parameter[1]).toBeCloseTo(5.936011816838997, 12);
    expect(o.pValue).toBeCloseTo(0.002545503613063806, 15);
    const k = kruskalTest(x, g);
    expect(k.statistic).toBeCloseTo(5.3333333333333357, 12);
    expect(k.parameter).toBe(1);
    const p = pairwiseTTest(x, g);
    expect(p.rowNames).toEqual(["2"]);
    expect(p.colNames).toEqual(["10"]);
    expect(p.pValue[0]![0]).toBeCloseTo(0.0024684228122780487, 15);
    expect(pairwiseWilcoxTest(x, g).rowNames).toEqual(["2"]);
  });

  it("writes numbers as R's as.character does (1e15 and \"1e+15\" are one level)", () => {
    const r = labelledGroups([1, 2, 3, 5, 8, 13], [1e15, 1e15, "1e+15", "1e+15", "a", "a"]);
    expect(r.labels).toEqual(["1e+15", "a"]);
    expect(kruskalTest([1, 2, 3, 5, 8, 13], [1e15, 1e15, "1e+15", "1e+15", "a", "a"]).statistic).toBeCloseTo(3.428571428571427, 12);
  });

  it("orders string labels by code point", () => {
    const labels = ["\u{10000}", "", "\u{10000}", ""];
    expect(labelledGroups([1, 2, 3, 4], labels).labels).toEqual(["", "\u{10000}"]);
    expect(pairwiseTTest([1, 2, 3, 4], labels).colNames).toEqual([""]);
  });

  it("leaves numeric labels as before", () => {
    expect(labelledGroups([1, 2, 3, 4, 5, 6], [10, 2, 1, 10, 2, 1]).labels).toEqual(["1", "2", "10"]);
    expect(labelledGroups([1, 2, 3], [1, NaN, "a"]).labels).toEqual(["1", "a"]);
  });
});
