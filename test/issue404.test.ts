// Issue #404: expm's "Taylor" (and "Pade") scale by N = 2^p with p >= 5, which takes a subnormal entry to 0 or rounds
// it. expm(A) of the nilpotent A = [[0, a], [0, 0]] is I + A. R 4.5.2 (expm package): a = 2^-1074 gives [1, 2] = 0
// with "Taylor" and "Pade" at orders 1 and 8; a = 1e-310 gives 0x1.2688b70e62p-1030 (9.9999999999945e-311) with
// "Taylor" and 0x1.2688b70e64p-1030 with "Pade". Where the scaling would take a nonzero entry below 2^-1022, the
// floor p >= 5 is now dropped (|A / N| <= 1/16 kept) (review_fix_log_issue404.md).
import { describe, expect, it } from "vitest";
import { expm } from "../src/index.js";

const M = Number.MIN_VALUE;

describe("issue #404", () => {
  it("keeps a subnormal entry of a nilpotent matrix with Taylor", () => {
    for (const method of ["Taylor", "TaylorO"] as const)
      for (const order of [1, 8]) {
        expect(expm([[0, M], [0, 0]], { method, order })).toEqual([[1, M], [0, 1]]);
        expect(expm([[0, 1e-310], [0, 0]], { method, order })).toEqual([[1, 1e-310], [0, 1]]);
        expect(expm([[1e-310, 2e-310], [3e-310, 4e-310]], { method, order })).toEqual([[1, 2e-310], [3e-310, 1]]);
      }
  });

  it("improves Pade where the scaling was the loss", () => {
    // closer to 1e-310 than R's 1.00000000000103e-310; 2^-1074 stays 0 (the coefficient 1/2 of the Padé approximant)
    expect(expm([[0, 1e-310], [0, 0]], { method: "Pade" })).toEqual([[1, 1.00000000000005e-310], [0, 1]]);
    expect(expm([[0, M], [0, 0]], { method: "Pade" })).toEqual([[1, 0], [0, 1]]);
  });

  it("keeps the values where no entry falls below the normal range", () => {
    expect(expm([[0, 1e-300], [0, 0]], { method: "Taylor" })).toEqual([[1, 1e-300], [0, 1]]);
    // a nonzero entry falls, but 2^L >= nu already needs L = 1: unchanged (4.6707742704721e-310, exact 4.67077427047160e-310)
    expect(expm([[1, 1e-310], [0, 2]], { method: "Taylor" })[0]![1]).toBe(4.6707742704721e-310);
  });
});
