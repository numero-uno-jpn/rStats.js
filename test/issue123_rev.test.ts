// Revision of issue 123: r of grad, jacobian and hessian at most 512 (review_fix_log_issue123_rev.md).
// Beyond 512 every result was NaN (numDeriv too); now a RangeError before any evaluation. r <= 512 keeps its values.
import { describe, expect, it } from "vitest";
import { grad, hessian, jacobian } from "../src/index.js";

const f = (x: readonly number[]) => Math.sin(x[0]!) + x[0]! ** 2;

describe("issue 123 (revision)", () => {
  // (the huge r did not return before the revision: run "rejects" only on the new code)
  it.each([
    ["just beyond 512", [513, 2000]],
    ["huge", [2 ** 31, 1e16]],
  ])("rejects r > 512 (%s) at once, without calling the function", (_, rs) => {
    let calls = 0;
    const g = (x: readonly number[]) => {
      calls++;
      return f(x);
    };
    for (const r of rs) {
      const t = performance.now();
      expect(() => grad(g, [1], { r }), `grad ${r}`).toThrow("'r' must be at most 512");
      expect(() => hessian(g, [1], { r }), `hessian ${r}`).toThrow("'r' must be at most 512");
      expect(calls).toBe(0);
      // jacobian evaluates func at x first (for the number of values), and only there
      expect(() => jacobian((x) => [g(x)], [1], { r }), `jacobian ${r}`).toThrow("'r' must be at most 512");
      expect(calls).toBe(1);
      calls = 0;
      expect(performance.now() - t).toBeLessThan(100);
    }
    // "simple" does not use r, as in numDeriv
    expect(grad(f, [1], { method: "simple", r: 1e16 })).toEqual(grad(f, [1], { method: "simple" }));
  });

  it("keeps the values up to r = 512 (the values before the revision)", () => {
    expect(grad(f, [1], { r: 20 })[0]).toBe(2.5403011122263432);
    expect(jacobian((x) => [f(x)], [1], { r: 41 })[0]![0]).toBe(0.07754986974849315);
    expect(hessian(f, [1], { r: 20 })[0]![0]).toBe(1.1610966185222744);
    // numDeriv also gives 0 at r = 512 (the steps no longer move x)
    expect(grad(f, [1], { r: 512 })).toEqual([0]);
    expect(hessian(f, [1], { r: 512 })).toEqual([[0]]);
  });
});
