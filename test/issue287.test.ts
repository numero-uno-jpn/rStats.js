// Issue #287: the goodness-of-fit simulation drew all B n categories at once (sampleInt, one array of B n entries;
// chisqTest([1e9, 1e9], { simulatePValue: true, B: 1 }) asked for 2e9). The draws are now made n at a time and counted
// without keeping them (the same uniforms in the same order), and B n is limited to 2^27 draws.
import { describe, expect, it } from "vitest";
import { chisqTest, runif, sampleInt, setSeed } from "../src/index.js";

describe("issue #287", () => {
  it("B n beyond 2^27 is an error", () => {
    expect(() => chisqTest([1e9, 1e9], { simulatePValue: true, B: 2000 })).toThrow("B * sum(x) <= 2^27");
  });

  // (before the fix this reaches a 2e9-entry array: excluded from the stash check with -t)
  it("alloc: the issue's B = 1 with a total of 2e9, and just above the limit", () => {
    expect(() => chisqTest([1e9, 1e9], { simulatePValue: true, B: 1 })).toThrow("B * sum(x) <= 2^27");
    expect(() => chisqTest([2 ** 26, 2 ** 26 + 1], { simulatePValue: true, B: 1 })).toThrow("B * sum(x) <= 2^27");
  });

  // p-values and the next uniform of the implementation before this change (the first is R's documented
  // set.seed(1); chisq.test(c(20, 15, 25), simulate.p.value = TRUE))
  it("p-values and the random stream unchanged", () => {
    const run = (x: number[], o: object): [number, number] => {
      setSeed(1);
      const r = chisqTest(x, { simulatePValue: true, ...o });
      return [r.pValue, runif(1)[0]!];
    };
    expect(run([20, 15, 25], {})).toEqual([0.296351824087956, 0.6335739591158926]);
    expect(run([5, 9, 3, 7], { p: [0.1, 0.4, 0.2, 0.3], B: 500 })).toEqual([0.3712574850299401, 0.26801513880491257]);
    // 301 categories: Walker's alias method
    const big = Array.from({ length: 301 }, (_, i) => (i % 7) + 1);
    expect(run(big, { B: 50 })).toEqual([0.47058823529411764, 0.9006100811529905]);
    setSeed(3);
    expect(sampleInt(301, { size: 10, replace: true, prob: big })).toEqual([172, 139, 285, 275, 209, 25, 135, 107, 260, 82]);
    expect(sampleInt(4, { size: 10, replace: true, prob: [1, 2, 3, 4] })).toEqual([2, 0, 2, 1, 3, 3, 3, 2, 3, 3]);
  });
});
