// Issue #72: expm with an order beyond R's integer range (review_fix_log_issue72.md).
// (Before the fix these calls did not return: the loops j = order, ..., 1 stall from 2^53 on. Not run on the old code.)
import { describe, expect, it } from "vitest";
import { expm } from "../src/index.js";

const M = [
  [0, 1],
  [0, 0],
];

describe("issue #72", () => {
  it("rejects an order beyond 2147483647 (R's expm fails there too)", () => {
    for (const method of ["Taylor", "TaylorO", "Pade", "PadeO"] as const) {
      for (const order of [2 ** 31, 1e16, 1e308]) {
        expect(() => expm(M, { method, order }), `${method} ${order}`).toThrow(RangeError);
      }
    }
  });

  it("keeps the values for an ordinary order", () => {
    for (const method of ["Taylor", "Pade"] as const) {
      for (const order of [2, 8]) expect(expm(M, { method, order })).toEqual([[1, 1], [0, 1]]);
    }
    // the Higham08 methods ignore order, as in R
    expect(expm(M, { method: "Higham08", order: 1e16 })).toEqual([[1, 1], [0, 1]]);
  });
});
