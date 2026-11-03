// Issue #425: rlaplace with an infinite mu or sigma follows qlaplace and draws what extraDistr draws, the rule of
// issue 92 (review_fix_log_issue425.md). extraDistr 1.10 (set.seed(1)): rlaplace(1, Inf, 1) is Inf and
// rlaplace(1, -Inf, 1) -Inf with 2 uniforms drawn (exponential and sign); rlaplace(1, 0, Inf) is -Inf with 2 drawn
// (here NaN, as qlaplace, dlaplace and plaplace); sigma NaN or 0 is NA without a draw.
import { describe, expect, it } from "vitest";
import { rlaplace, runif, setSeed } from "../src/index.js";

setSeed(1);
const u = runif(6);

/** The result and the number of uniforms drawn */
function run(f: () => number[]): { values: number[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #425", () => {
  it("takes an infinite mu as the limit, after extraDistr's draws", () => {
    expect(run(() => rlaplace(1, { mu: Infinity, sigma: 1 }))).toEqual({ values: [Infinity], drawn: 2 });
    expect(run(() => rlaplace(1, { mu: -Infinity, sigma: 1 }))).toEqual({ values: [-Infinity], drawn: 2 });
  });

  it("gives NaN for sigma = Inf, after extraDistr's draws", () => {
    expect(run(() => rlaplace(2, { mu: 0, sigma: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 4 });
    expect(run(() => rlaplace(2, { mu: Infinity, sigma: Infinity }))).toEqual({ values: [NaN, NaN], drawn: 4 });
  });

  it("keeps invalid parameters without a draw and finite ones unchanged", () => {
    expect(run(() => rlaplace(1, { mu: 0, sigma: NaN }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rlaplace(1, { mu: 0, sigma: 0 }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rlaplace(1, { mu: NaN, sigma: 1 }))).toEqual({ values: [NaN], drawn: 0 });
    const r = run(() => rlaplace(2, { mu: 0, sigma: 1 }));
    expect(r.drawn).toBe(4);
    expect(r.values[0]).toBeCloseTo(-0.7551818, 7);
    expect(r.values[1]).toBeCloseTo(0.1457067, 7);
  });
});
