// The examples of docs/guide-for-js-developers.md (and its Japanese translation docs/ja/guide-for-js-developers.md),
// run as written: the values the guide shows in comments are checked here. Change both when changing one.
import { describe, expect, it } from "vitest";
import {
  aggregate, chisqTest, completeCases, corTest, fromRows, kruskalTest, mean, naOmit, sd, split, subset, tapply,
  toRows, tTest, wilcoxTest,
} from "../src/index.js";

const rows = [
  { id: 1, arm: "drug", sex: "F", age: 34, score: 7.1, improved: "yes" },
  { id: 2, arm: "drug", sex: "M", age: 51, score: 6.4, improved: "yes" },
  { id: 3, arm: "drug", sex: "F", age: 17, score: 8.2, improved: "yes" },
  { id: 4, arm: "drug", sex: "M", age: 45, score: null, improved: "no" },
  { id: 5, arm: "drug", sex: "F", age: 29, score: 7.8, improved: "yes" },
  { id: 6, arm: "drug", sex: "M", age: 62, score: 6.9, improved: "no" },
  { id: 7, arm: "placebo", sex: "F", age: 38, score: 5.2, improved: "no" },
  { id: 8, arm: "placebo", sex: "M", age: 44, score: 6.0, improved: "yes" },
  { id: 9, arm: "placebo", sex: "F", age: 57, score: 4.9, improved: "no" },
  { id: 10, arm: "placebo", sex: "M", age: 23, score: 5.6, improved: "no" },
  { id: 11, arm: "placebo", sex: "F", age: 41, score: 6.3, improved: "yes" },
  { id: 12, arm: "placebo", sex: "M", age: 36, score: 5.1, improved: "no" },
];
const round = (x: number, digits = 4): number => Number(x.toFixed(digits));

describe("guide for JavaScript developers", () => {
  it("data frames", () => {
    const d = fromRows(rows);
    expect(Array.from(d.score!).slice(0, 4)).toEqual([7.1, 6.4, 8.2, null]);
    expect(toRows(d)[0]).toEqual(rows[0]);
    expect(completeCases(d).filter((ok) => !ok).length).toBe(1);
  });

  it("the workflow", () => {
    const d = fromRows(rows);
    const adults = naOmit(subset(d, (r) => (r.age as number) >= 18));
    expect(adults.id).toEqual([1, 2, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(aggregate("score ~ arm", adults, mean)).toEqual({ arm: ["drug", "placebo"], score: [7.05, 5.516666666666667] });
    const bySex = aggregate("score ~ arm + sex", adults, (v) => ({ mean: mean(v), sd: sd(v) }));
    expect(bySex.arm).toEqual(["drug", "placebo", "drug", "placebo"]);
    expect(bySex.sex).toEqual(["F", "F", "M", "M"]);
    expect((bySex["score.mean"] as number[]).map((x) => round(x))).toEqual([7.45, 5.4667, 6.65, 5.5667]);
    expect((bySex["score.sd"] as number[]).map((x) => round(x))).toEqual([0.495, 0.7371, 0.3536, 0.4509]);

    const t = tTest("score ~ arm", adults);
    expect(round(t.statistic)).toBe(4.1818);
    expect(round(t.parameter as number)).toBe(6.3048);
    expect(round(t.pValue)).toBe(0.0052);
    expect(t.confInt!.map((x) => round(x))).toEqual([0.6465, 2.4201]);
    expect(t.method).toBe("Welch Two Sample t-test");
    expect(t.estimateNames).toEqual(["mean in group drug", "mean in group placebo"]);
    const w = wilcoxTest("score ~ arm", adults);
    expect(w.statistic).toBe(24);
    expect(round(w.pValue)).toBe(0.0095);
  });

  it("more than two groups, tables, correlation", () => {
    const d = naOmit(fromRows(rows));
    const k = kruskalTest("score ~ sex", d);
    expect(round(k.pValue)).toBe(0.4652);
    const tab = chisqTest(d.arm as string[], d.improved as string[]);
    expect(round(tab.statistic)).toBe(0.8831);
    expect(round(tab.pValue)).toBe(0.3474);
    const r = corTest("~ age + score", d, { method: "spearman" });
    expect(round(r.estimate as number)).toBe(-0.3636);
    expect(round(r.pValue)).toBe(0.2732);
  });

  it("grouping", () => {
    const d = naOmit(fromRows(rows));
    const m = tapply(d.score as number[], d.arm as string[], mean);
    expect(m.dimnames).toEqual([["drug", "placebo"]]);
    expect(m.values.map((x) => round(x))).toEqual([7.28, 5.5167]);
    const groups = split(d.score as number[], d.arm as string[]);
    expect([...groups.keys()]).toEqual(["drug", "placebo"]);
    expect(groups.get("drug")).toEqual([7.1, 6.4, 8.2, 7.8, 6.9]);
  });
});
