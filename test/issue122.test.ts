// Issue #122: integrate over an interval whose doubled end overflows halves absTol, and absTol = MIN became 0, which
// QUADPACK takes for an invalid input (review_fix_log_issue122.md). MIN is not attainable here: the error is now the
// round-off one, as with 2 MIN and as R 4.5.2 gives for this integral.
import { describe, expect, it } from "vitest";
import { integrate } from "../src/index.js";

const f = (): number => 1e-308;

describe("issue #122", () => {
  it("keeps a positive absTol positive", () => {
    expect(() => integrate(f, -1e308, 1e308, { absTol: Number.MIN_VALUE, relTol: 0 })).toThrow("roundoff error was detected");
    expect(() => integrate(f, -1e308, 1e308, { absTol: 2 * Number.MIN_VALUE, relTol: 0 })).toThrow("roundoff error was detected");
  });

  it("integrates with an attainable tolerance", () => {
    expect(Math.abs(integrate(f, -1e308, 1e308, { absTol: 1e-10, relTol: 0 }).value - 2)).toBeLessThan(1e-10);
  });
});
