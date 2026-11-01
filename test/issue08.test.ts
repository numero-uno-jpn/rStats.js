// Issue #8: lmerAnova compares the fixed effects of fits as column spaces (review_fix_log_issue08.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/models/lmer.js";
import { lmerAnova } from "../src/models/lmerAnova.js";

// (R: set.seed(8); 6 groups of 4, y = 1 + 0.5 x + noise)
const x = [-0.084586071371023799, 0.84040012559747606, -0.46348277218799119, -0.55083500448037928, 0.73604043210529291, -0.10788140150681826, -0.17028914982177021, -1.088331711869543, -3.0110516757679822, -0.59317433280124856, -0.75979379630207085, 0.29204986366069265, 0.42139859457908653, -1.2944890810008922, 0.069285088863448969, -0.8130384772720463, 1.5108530723578506, -0.27160887995989698, 1.5582539286213675, -0.23734987010454187, 1.2831228822529355, -0.0094896358219330175, -0.40008278165923548, 0.021985623821209095];
const y = [2.7004743455122786, 0.31302590349270831, -0.29223086858380864, 2.6757438171174295, 1.9707269586597505, -1.0745501815887877, 2.4215309679646566, 1.4195452332348102, -2.0594172500949166, -0.070229545124340431, 1.8808810573747184, 1.5744807107114045, 2.0552828342457445, -0.346395092622401, 0.96978026784785811, 1.0644644067875342, 2.1189271578636864, 0.24963965084487438, 2.008076254753643, 0.61926823120383601, 2.2541174318184902, -0.96235731053567495, 0.13645113770574369, 1.2947803273477805];
const g = Array.from({ length: 24 }, (_, i) => "abcdef"[Math.floor(i / 4)]!);
const f3 = Array.from({ length: 24 }, (_, i) => "pqr"[i % 3]!);
const d = { y, x, g, f3 };

describe("issue #8", () => {
  it("tests nested fits whose factor has other contrasts", () => {
    // contr.sum against contr.treatment: the names differed, so the comparison was not tested
    const small = lmer("y ~ f3 + (1 | g)", d, { REML: false, contrasts: { f3: "contr.sum" } });
    const large = lmer("y ~ f3 + x + (1 | g)", d, { REML: false });
    const same = lmerAnova([lmer("y ~ f3 + (1 | g)", d, { REML: false }), large]);
    const r = lmerAnova([small, large]);
    expect(r.Chisq[1]).toBeGreaterThan(0);
    expect(Math.abs(r.Chisq[1]! - same.Chisq[1]!)).toBeLessThan(1e-8);
    expect(Math.abs(r.pValue[1]! - same.pValue[1]!)).toBeLessThan(1e-9);
  });

  it("does not test fits that are not nested", () => {
    const r = lmerAnova([lmer("y ~ x + (1 | g)", d, { REML: false }), lmer("y ~ f3 + (1 | g)", d, { REML: false })]);
    expect(Number.isNaN(r.Chisq[1])).toBe(true);
  });
});
