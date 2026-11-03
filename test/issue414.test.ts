// Issue #414: sampleInt's weighted path rejects size 2^31 or more before allocating or drawing, as R's asInteger
// (review_fix_log_issue414.md). R 4.5.2: sample.int(2, 2147483648, replace = TRUE, prob = c(0.5, 0.5)) is
// "invalid 'size' argument" without a draw, also with replace = FALSE, size 1e15 or 2147483648.5, and before an
// invalid prob is reported.
// The first test does not end before the fix (2^31 weighted draws); leave it out of a stash check with -t.
import { describe, expect, it } from "vitest";
import { runif, sample, sampleInt, setSeed } from "../src/index.js";

setSeed(1);
const u = runif(3);

/** The error message and the number of uniforms drawn */
function run(f: () => unknown): { error: string; drawn: number } {
  setSeed(1);
  let error = "";
  try {
    f();
  } catch (e) {
    error = (e as Error).message;
  }
  return { error, drawn: u.indexOf(runif(1)[0]!) };
}

const rejected = { error: "size must be less than 2^31 with prob", drawn: 0 };

describe("issue #414", () => {
  it("rejects a weighted size of 2^31 with replacement", () => {
    expect(run(() => sampleInt(2, { size: 2147483648, replace: true, prob: [0.5, 0.5] }))).toEqual(rejected);
    expect(run(() => sampleInt(2, { size: 1e15, replace: true, prob: [0.5, 0.5] }))).toEqual(rejected);
    expect(run(() => sample([3, 7], { size: 2147483648.5, replace: true, prob: [0.5, 0.5] }))).toEqual(rejected);
  });

  it("rejects it before checking prob or the population size", () => {
    expect(run(() => sampleInt(2, { size: 2147483648, prob: [0.5, 0.5] }))).toEqual(rejected);
    expect(run(() => sampleInt(2, { size: 2147483648, replace: true, prob: [-1, 0.5] }))).toEqual(rejected);
  });

  it("keeps smaller weighted sizes and the unweighted path", () => {
    setSeed(1);
    expect(sampleInt(2, { size: 3.5, replace: true, prob: [0.5, 0.5] })).toEqual([1, 1, 0]);
    expect(() => sampleInt(2, { size: 2147483648 })).toThrow("larger than the population");
  });
});
