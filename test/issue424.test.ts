// Issue #424: the noncentral rchisq with df = Inf is Inf after the Poisson mixture's draws, as R's rnchisq (which
// rejects only a NaN df). R 4.5.2, set.seed(1): rchisq(1, Inf, ncp = 0) Inf with no draw; rchisq(1, Inf, ncp = 2) Inf,
// 1 uniform drawn; rchisq(3, Inf, ncp = 2) 5; rchisq(2, Inf, ncp = 20) 9. The central rchisq(1, Inf), ncp = Inf and
// df = -Inf stay NaN without a draw (review_fix_log_issue424.md).
import { describe, expect, it } from "vitest";
import { rchisq, runif, setSeed } from "../src/index.js";

setSeed(1);
const u = runif(20);

/** The result and the number of uniforms drawn */
function run(f: () => number[]): { values: number[]; drawn: number } {
  setSeed(1);
  const values = f();
  return { values, drawn: u.indexOf(runif(1)[0]!) };
}

describe("issue #424", () => {
  it("gives Inf for df = Inf with R's draws", () => {
    expect(run(() => rchisq(1, Infinity, { ncp: 0 }))).toEqual({ values: [Infinity], drawn: 0 });
    expect(run(() => rchisq(1, Infinity, { ncp: 2 }))).toEqual({ values: [Infinity], drawn: 1 });
    expect(run(() => rchisq(3, Infinity, { ncp: 2 }))).toEqual({ values: [Infinity, Infinity, Infinity], drawn: 5 });
    expect(run(() => rchisq(2, Infinity, { ncp: 20 }))).toEqual({ values: [Infinity, Infinity], drawn: 9 });
  });

  it("keeps NaN without a draw for the central df = Inf, ncp = Inf and df = -Inf", () => {
    expect(run(() => rchisq(1, Infinity))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rchisq(1, Infinity, { ncp: Infinity }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rchisq(1, -Infinity, { ncp: 2 }))).toEqual({ values: [NaN], drawn: 0 });
    expect(run(() => rchisq(1, NaN, { ncp: 2 }))).toEqual({ values: [NaN], drawn: 0 });
  });
});
