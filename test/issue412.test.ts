// Issue #412: rmultinom's n and size truncated before they are checked, as R's as.integer (review_fix_log_issue412.md).
// R 4.5.2 (set.seed(1)): rmultinom(1, 2.5, c(0.5, 0.5)) is (1, 1) with one uniform drawn, as size 2; n -0.5 gives no
// columns and size -0.5 zeros, without a draw; size -1, n -1 and -1.5, size NaN and 2^31 are errors;
// rmultinom(2.7, 3.7, c(0.2, 0.3, 0.5)) is (0, 1, 2), (1, 2, 0) with 4 uniforms drawn.
import { describe, expect, it } from "vitest";
import { rmultinom, runif, setSeed } from "../src/index.js";

setSeed(1);
const u = runif(5);

/** The result and the number of uniforms drawn */
function run(f: () => number[][]): { values: number[][]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #412", () => {
  it("truncates a fractional size", () => {
    expect(run(() => rmultinom(1, 2.5, [0.5, 0.5]))).toEqual({ values: [[1, 1]], drawn: 1 });
    expect(run(() => rmultinom(1, 2.9, [0.5, 0.5]))).toEqual(run(() => rmultinom(1, 2, [0.5, 0.5])));
    expect(run(() => rmultinom(2.7, 3.7, [0.2, 0.3, 0.5]))).toEqual({
      values: [
        [0, 1, 2],
        [1, 2, 0],
      ],
      drawn: 4,
    });
  });

  it("takes an n or size in (-1, 0) as 0", () => {
    expect(run(() => rmultinom(-0.5, 2, [0.5, 0.5]))).toEqual({ values: [], drawn: 0 });
    expect(run(() => rmultinom(1, -0.5, [0.5, 0.5]))).toEqual({ values: [[0, 0]], drawn: 0 });
    expect(run(() => rmultinom(2, -0.9, [0.2, 0.3, 0.5]))).toEqual({
      values: [
        [0, 0, 0],
        [0, 0, 0],
      ],
      drawn: 0,
    });
  });

  it("still rejects what R rejects", () => {
    expect(() => rmultinom(1, -1, [0.5, 0.5])).toThrow(RangeError);
    expect(() => rmultinom(-1, 2, [0.5, 0.5])).toThrow(RangeError);
    expect(() => rmultinom(-1.5, 2, [0.5, 0.5])).toThrow(RangeError);
    expect(() => rmultinom(1, NaN, [0.5, 0.5])).toThrow(RangeError);
    expect(() => rmultinom(1, 2 ** 31, [0.5, 0.5])).toThrow(RangeError);
    expect(rmultinom(1, 2147483647.5, [0.5, 0.5])[0]!.reduce((a, b) => a + b)).toBe(2147483647);
  });
});
