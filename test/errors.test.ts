// Error type convention: wrong type or shape → TypeError, value out of range → RangeError,
// computational failure → Error. Messages are in English.

import { describe, expect, it } from "vitest";
import {
  brunnerMunzelTest, chisqTest, chol, crossprod, dgamma, dnbinom, eigen, fisherTest, norm, pAdjust, qr, qrResid, rnorm, sampleInt, setSeed,
  solve, svd, tTest,
} from "../src/index.js";

/** Checks that f throws an error of exactly class cls (not a subclass) with an English message */
function expectError(f: () => unknown, cls: typeof Error | typeof TypeError | typeof RangeError): void {
  let err: unknown;
  try {
    f();
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).constructor).toBe(cls);
  expect((err as Error).message).toMatch(/^[\x20-\x7e]+$/);
}

describe("error types", () => {
  it("wrong type or shape throws TypeError", () => {
    expectError(() => crossprod([[1, 2], [3]]), TypeError);
    expectError(() => crossprod([[1], [2]], [[1], [2], [3]]), TypeError);
    expectError(() => solve([[1, 2, 3], [4, 5, 6]]), TypeError);
    expectError(() => tTest([1, 2, 3], { paired: true }), TypeError);
    expectError(() => dnbinom(1, 2, { prob: 0.5, mu: 1 }), TypeError);
    expectError(() => qrResid(qr([[1], [2]], { lapack: true }), [1, 2]), TypeError);
  });

  it("value out of range throws RangeError", () => {
    expectError(() => rnorm(-1), RangeError);
    expectError(() => setSeed(Infinity), RangeError);
    expectError(() => sampleInt(3, { size: 5 }), RangeError);
    expectError(() => dgamma(1, 2, { rate: 2, scale: 2 }), RangeError);
    expectError(() => tTest([1, 2, 3], { alternative: "bigger" as never }), RangeError);
    expectError(() => tTest([1, 2, 3], { confLevel: 2 }), RangeError);
    expectError(() => pAdjust([0.1, 0.2], { method: "nope" as never }), RangeError);
    expectError(() => brunnerMunzelTest([], [1, 2]), RangeError);
    expectError(() => brunnerMunzelTest([1, 2], [NaN]), RangeError);
    expectError(() => chisqTest([-1, 2, 3]), RangeError);
    expectError(() => fisherTest([[1, 2], [3, -1]]), RangeError);
    expectError(() => norm([[1]], { type: "X" }), RangeError);
    expectError(() => svd([[1, NaN]]), RangeError);
  });

  it("computational failure throws Error", () => {
    expectError(() => solve([[1, 2], [2, 4]]), Error);
    expectError(() => chol([[1, 2], [2, 1]]), Error);
    expectError(() => tTest([5, 5, 5]), Error);
  });

  it("successful calls do not throw", () => {
    expect(() => eigen([[2, 1], [1, 2]])).not.toThrow();
  });
});
