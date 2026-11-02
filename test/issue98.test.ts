// Issue #98: the length of seqLength, approx, spline and seq (review_fix_log_issue98.md). R 4.5.2: approx and
// spline with n = NaN or Inf are errors; seq(0, 10, length.out = -0.1) is integer(0) (rounded up to 0), -1, NaN and
// Inf are errors.
import { describe, expect, it } from "vitest";
import { approx, seq, spline } from "../src/index.js";
import { seqLength } from "../src/internal/seq.js";

describe("issue #98", () => {
  it("refuses a length of approx and spline that is NaN or infinite", () => {
    for (const n of [NaN, Infinity, -0.5]) {
      expect(() => approx([1, 2, 3], [1, 2, 3], { n }), String(n)).toThrow(RangeError);
      expect(() => spline([1, 2, 3], [1, 2, 3], { n }), String(n)).toThrow(RangeError);
    }
  });

  it("keeps fractional lengths of approx and spline (rounded up, as R)", () => {
    expect(approx([1, 2, 3], [1, 2, 3], { n: 0.5 })).toEqual({ x: [1], y: [1] });
    expect(approx([1, 2, 3], [1, 2, 3], { n: 2.1 }).x).toEqual([1, 2, 3]);
    expect(spline([1, 2, 3], [1, 2, 3], { n: 0.5 }).x).toEqual([1]);
    expect(spline([1, 2, 3], [1, 4, 9], { n: 2.1 }).x).toEqual([1, 2, 3]);
  });

  it("takes a length.out of seq in (-1, 0) as 0, as R", () => {
    expect(seq(0, 10, { lengthOut: -0.1 })).toEqual([]);
    expect(seq(0, 10, { lengthOut: -0.999 })).toEqual([]);
    expect(seq(5, undefined, { lengthOut: -0.1 })).toEqual([]);
    expect(seq(0, 10, { lengthOut: 0 })).toEqual([]);
    expect(seq(0, 10, { lengthOut: 2.1 })).toEqual([0, 5, 10]);
    for (const n of [-1, NaN, Infinity]) expect(() => seq(0, 10, { lengthOut: n }), String(n)).toThrow(RangeError);
  });

  it("refuses an invalid length in seqLength instead of returning an empty array", () => {
    for (const n of [NaN, -1, Infinity]) expect(() => seqLength(0, 10, n), String(n)).toThrow(RangeError);
    expect(seqLength(0, 10, -0.5)).toEqual([]);
    expect(seqLength(0, 10, 0)).toEqual([]);
    expect(seqLength(0, 10, 2.1)).toEqual([0, 5, 10]);
  });
});
