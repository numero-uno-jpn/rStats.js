// Issue #428: rtriang with an infinite endpoint is NaN, as qtriang, and draws the two uniforms extraDistr draws, the
// rule of issue 92 (review_fix_log_issue428.md). extraDistr 1.10 (set.seed(1)): rtriang(1, 0, Inf, 1) is Inf (here
// NaN) and rtriang(1, -Inf, 0, -1), (1, -Inf, Inf, 0), (1, 0, Inf, Inf) and (1, 0, Inf) NaN, each with 2 uniforms
// drawn; rtriang(1, -Inf, Inf) (c NaN), (1, Inf, Inf, Inf) and (1, 0, 1, 2) are NA without a draw.
import { describe, expect, it } from "vitest";
import { rtriang, runif, setSeed } from "../src/index.js";

setSeed(1);
const u = runif(6);

/** The result and the number of uniforms drawn */
function run(f: () => number[]): { values: number[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #428", () => {
  it("gives NaN for an infinite endpoint, after extraDistr's two uniforms", () => {
    const cases = [
      { a: 0, b: Infinity, c: 1 },
      { a: -Infinity, b: 0, c: -1 },
      { a: -Infinity, b: Infinity, c: 0 },
      { a: 0, b: Infinity, c: Infinity },
      { a: 0, b: Infinity },
      { a: -Infinity, b: 0, c: -Infinity },
    ];
    for (const o of cases) expect(run(() => rtriang(1, o)), JSON.stringify(o)).toEqual({ values: [NaN], drawn: 2 });
    expect(run(() => rtriang(2, { a: 0, b: Infinity, c: 1 }))).toEqual({ values: [NaN, NaN], drawn: 4 });
  });

  it("keeps invalid parameters without a draw and finite ones unchanged", () => {
    expect(run(() => rtriang(1, { a: -Infinity, b: Infinity }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rtriang(1, { a: Infinity, b: Infinity, c: Infinity }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rtriang(1, { a: 0, b: 1, c: 2 }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rtriang(1, { a: 0, b: 1, c: NaN }))).toEqual({ values: [NaN], drawn: 0 });
    const r = run(() => rtriang(2, { a: 0, b: 2, c: 1 }));
    expect(r.drawn).toBe(4);
    expect(r.values[0]).toBeCloseTo(0.6376326, 7);
    expect(r.values[1]).toBeCloseTo(1.4810612, 7);
  });
});
