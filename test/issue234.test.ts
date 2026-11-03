// Issue #234: a weight of 1e-16 next to 0.5 and 0.5 gets no interval in the descending cumulative sums. This is R's
// ProbSampleReplace and ProbSampleNoReplace; the draws and the stream are R's (a uniform has 2^-32 resolution, below
// which no order of the sums gives the weight its probability).
import { describe, expect, it } from "vitest";
import { runif, sampleInt, setSeed } from "../src/index.js";

const prob = [0.5, 0.5, 1e-16];
const draw = (size: number, replace: boolean) => sampleInt(3, { size, replace, prob }).map((v) => v + 1);

describe("issue #234", () => {
  it("with replacement: R's draws and next uniform", () => {
    setSeed(1);
    // R 4.5.2: set.seed(1); sample.int(3, 20, TRUE, c(0.5, 0.5, 1e-16)); runif(1)
    expect(draw(20, true)).toEqual([2, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 2, 1, 2, 1, 2, 1, 1, 2, 1]);
    expect(runif(1)[0]).toBe(0.9347052311059088);
  });

  it("without replacement: R's draws and next uniform", () => {
    setSeed(1);
    expect(draw(1, false)).toEqual([2]);
    expect(runif(1)[0]).toBe(0.37212389963679016);
    setSeed(1);
    expect(draw(3, false)).toEqual([2, 1, 3]);
    expect(runif(1)[0]).toBe(0.9082077899947762);
  });
});
