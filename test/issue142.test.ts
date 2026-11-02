// Issue #142 claimed that jonckheereTest's exact distribution for three or more groups is wrong because it convolves
// the Mann-Whitney distributions of each group against all later groups, which the issue took to be dependent. They are
// independent under the null (given the set of values in groups i..k, group i's ranks among them are uniform and
// independent of the arrangement of the later groups), so the convolution is exact: the issue's example gives p = 1/3,
// the value the issue itself derives (review_fix_log_issue142.md). Checked here against full enumeration of the
// permutations, including unequal group sizes.
import { describe, expect, it } from "vitest";
import { jonckheereTest } from "../src/index.js";

function enumerate(x: readonly number[], g: readonly number[]): { upper: number; lower: number } {
  const jt = (v: readonly number[]): number => {
    let s = 0;
    for (let i = 0; i < v.length; i++) for (let j = 0; j < v.length; j++) if (g[i]! < g[j]! && v[i]! < v[j]!) s++;
    return s;
  };
  const obs = jt(x);
  let ge = 0;
  let le = 0;
  let n = 0;
  const a = [...x];
  const perm = (k: number): void => {
    if (k === a.length) {
      const s = jt(a);
      n++;
      if (s >= obs) ge++;
      if (s <= obs) le++;
      return;
    }
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i]!, a[k]!];
      perm(k + 1);
      [a[k], a[i]] = [a[i]!, a[k]!];
    }
  };
  perm(0);
  return { upper: ge / n, lower: le / n };
}

describe("issue #142: jonckheereTest's exact distribution for three or more groups", () => {
  it("one observation per group: the issue's example, two-sided p = 1/3", () => {
    expect(jonckheereTest([1, 2, 3], [1, 2, 3], { exact: true }).pValue).toBeCloseTo(1 / 3, 15);
    expect(jonckheereTest([1, 2, 3], [1, 2, 3], { exact: true, alternative: "increasing" }).pValue).toBeCloseTo(1 / 6, 15);
  });

  it.each([
    [[3, 1, 4, 2, 6, 5, 9, 7, 8], [1, 1, 2, 2, 2, 3, 3, 3, 3]],
    [[5, 2, 8, 1, 7, 3, 6, 4], [1, 2, 2, 3, 3, 3, 4, 4]],
    [[2, 9, 4, 1, 8, 6, 3, 7, 5], [1, 1, 1, 2, 2, 2, 3, 3, 3]],
  ])("agrees with the enumeration of all permutations: %j by %j", (x, g) => {
    const { upper, lower } = enumerate(x, g);
    expect(jonckheereTest(x, g, { exact: true, alternative: "increasing" }).pValue).toBeCloseTo(upper, 14);
    expect(jonckheereTest(x, g, { exact: true, alternative: "decreasing" }).pValue).toBeCloseTo(lower, 14);
    expect(jonckheereTest(x, g, { exact: true }).pValue).toBeCloseTo(Math.min(1, 2 * Math.min(upper, lower)), 14);
  });
});
