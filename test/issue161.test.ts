// Issue #161 (with #162, #163): near y = mu the first-order terms of the binomial, poisson and Gamma deviances
// cancel, and the direct forms lose about 2 eps / abs(t) relative (t = (y - mu)/mu): the binomial contribution at
// y = 0.5, mu = 0.5 + 2^-52 was negative, and at t = 1e-3 all three were 1e-10 off (R the same). Where abs(y - mu) <
// 0.1 mu (binomial: 0.1 min(mu, 1 - mu)) they are now formed as bd0 (log1pmx for Gamma), as R's dpois_raw and
// dbinom_raw switch to bd0 (review_fix_log_issue161.md). References: Rmpfr with 300 bits on the doubles given.
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #161", () => {
  it("binomial deviance near the mean", () => {
    for (const f of ["binomial", "quasibinomial", { family: "quasi", variance: "mu(1-mu)" }] as const) {
      const b = makeFamily(f);
      // R 4.5.2: -9.8607613152626481e-32; before: -1.9721522630525295e-31
      expect(rel(b.devContribution(0.5, 0.5 + 2 ** -52, 1), 1.9721522630525295e-31)).toBeLessThan(4e-16);
      // R and before: 4.2840832491838204e-7 (9e-11 off); 1 - 0.3 is rounded, so the second term uses mu - y
      expect(rel(b.devContribution(0.3, 0.3003, 1), 4.2840832495710014632e-7)).toBeLessThan(4e-16);
    }
  });

  it("keeps the bits beyond 10% of the mean", () => {
    // values of the implementation before the fix
    const b = makeFamily("binomial");
    expect(b.devContribution(0.3, 0.6, 1)).toBe(0.36757379477362434);
    expect(b.devContribution(0.2, 0.25, 1)).toBe(0.014004213294429982);
    expect(b.devContribution(0, 0.4, 1)).toBe(1.0216512475319814);
    expect(b.devContribution(1, 0.9, 1)).toBe(0.2107210313156527);
  });
});
