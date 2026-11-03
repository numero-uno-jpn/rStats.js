// Issue #356: jacobian took the number of rows from func(x) and read the shifted evaluations without checking their
// lengths: a shorter result gave NaN entries, a longer one was cut. numDeriv stops with an error in both cases; a
// RangeError now (review_fix_log_issue356.md).
import { describe, expect, it } from "vitest";
import { jacobian } from "../src/index.js";

describe("issue #356", () => {
  const shorter = (x: number[]) => (x[0] === 1 ? [1] : []);
  const longer = (x: number[]) => (x[0] === 1 ? [1] : [x[0]!, 99]);

  for (const method of ["Richardson", "simple"] as const) {
    it(`rejects a changing output length (${method})`, () => {
      expect(() => jacobian(shorter, [1], { method })).toThrow(RangeError);
      expect(() => jacobian(longer, [1], { method })).toThrow(/returned 2 values at a shifted x, but 1 at x/);
    });
  }

  it("leaves a constant length unchanged", () => {
    expect(jacobian((x) => [x[0]! * x[1]!, x[0]! + 2 * x[1]!], [2, 3], { method: "simple" })[0]![0]).toBeCloseTo(3, 6);
    expect(jacobian(() => [], [1, 2])).toEqual([]);
  });
});
