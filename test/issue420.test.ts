// Issue #420: the noncentral rf keeps its limits for an infinite df (X / df1, df2 / Y or 1; R NaN, an intended
// difference in docs/differences-from-r.md), but with df1 = Inf it now draws the Poisson mixture R's
// rchisq(n, Inf, ncp) draws, so the stream after the call is R's (review_fix_log_issue420.md). R 4.5.2, set.seed(1):
// rf(1, Inf, 5, ncp = 2) draws 4 uniforms (3 before), rf(3, Inf, 5, ncp = 2) 14 (7), rf(2, Inf, Inf, ncp = 2) 4 (0),
// rf(2, Inf, 5, ncp = 20) 16 (5); rf(1, Inf, 5, ncp = 0) 3 and rf(1, 5, Inf, ncp = 2) 4 (unchanged).
// R's rchisq(3, 5) after rchisq(3, Inf, ncp = 2): 0x1.0d12875484d2ap+3 0x1.508f4ee7c4c02p+2 0x1.5283d6c677853p+3.
import { describe, expect, it } from "vitest";
import { rf, runif, setSeed } from "../src/index.js";

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

setSeed(1);
const u = runif(20);

/** The result and the number of uniforms drawn */
function run(f: () => number[]): { values: number[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #420", () => {
  it("draws R's variates for df1 = Inf, keeping the limit 1 for X / df1", () => {
    const r = run(() => rf(3, Infinity, 5, { ncp: 2 }));
    expect(r.drawn).toBe(14);
    const y = ["0x1.0d12875484d2ap+3", "0x1.508f4ee7c4c02p+2", "0x1.5283d6c677853p+3"].map(hex);
    expect(r.values).toEqual(y.map((v) => 1 / (v / 5)));
    expect(run(() => rf(1, Infinity, 5, { ncp: 2 })).drawn).toBe(4);
    expect(run(() => rf(2, Infinity, 5, { ncp: 20 })).drawn).toBe(16);
    expect(run(() => rf(2, Infinity, Infinity, { ncp: 2 }))).toEqual({ values: [1, 1], drawn: 4 });
  });

  it("keeps the draws that already matched R", () => {
    expect(run(() => rf(1, Infinity, 5, { ncp: 0 })).drawn).toBe(3);
    expect(run(() => rf(1, 5, Infinity, { ncp: 2 })).drawn).toBe(4);
    expect(run(() => rf(1, Infinity, 5, { ncp: Infinity }))).toEqual({ values: [NaN], drawn: 3 });
  });
});
