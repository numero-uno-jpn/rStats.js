// Issue #76: optim with a maxit that is not an integer in R's range (review_fix_log_issue76.md).
// (Before the fix SANN with maxit Infinity did not return; not run on the old code.)
import { describe, expect, it } from "vitest";
import { optim } from "../src/index.js";

const f = (x: number[]) => x.reduce((s, v) => s + v * v, 0);

describe("issue #76", () => {
  it("rejects a maxit beyond R's integer range, as R ('maxit' is not an integer)", () => {
    for (const method of ["Nelder-Mead", "BFGS", "CG", "SANN", "L-BFGS-B"] as const) {
      for (const maxit of [Infinity, -Infinity, NaN, 3e9]) {
        expect(() => optim([1, 1], f, { method, control: { maxit } }), `${method} ${maxit}`).toThrow(RangeError);
      }
    }
  });

  it("truncates a fractional maxit, as R", () => {
    // R 4.5.2: optim(c(1, 1), ..., control = list(maxit = 2.7)) gives par 1 1, counts 5 NA
    const r = optim([1, 1], f, { control: { maxit: 2.7 } });
    expect(r.par).toEqual([1, 1]);
    expect(r.counts[0]).toBe(5);
    expect(r.counts).toEqual(optim([1, 1], f, { control: { maxit: 2 } }).counts);
  });
});
