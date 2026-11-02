// Issue #87: coxph's centring and scaling of a covariate around 1e308 (the sums overflowed and the column became 0)
// or subnormal (the scale overflowed) (review_fix_log_issue87.md). A covariate times 2^k gives the fit of the
// covariate with the coefficient and standard error times 2^-k, the same tests and the same log likelihood.
import { describe, expect, it } from "vitest";
import { coxph, type CoxphResult } from "../src/index.js";

const time = [1, 2, 3, 4];
const status = [1, 0, 1, 1];
const x = [1, 1.5, 0.5, 1.75];

function expectSameTests(f: CoxphResult, ref: CoxphResult, label: string) {
  expect(f.loglik, label).toEqual(ref.loglik);
  expect(f.z, label).toEqual(ref.z);
  expect(f.p, label).toEqual(ref.p);
  expect(f.wald, label).toBe(ref.wald);
  expect(f.score, label).toBe(ref.score);
  expect(f.logtest, label).toEqual(ref.logtest);
  expect(f.sctest, label).toEqual(ref.sctest);
  expect(f.waldtest, label).toEqual(ref.waldtest);
  expect(f.iter, label).toBe(ref.iter);
  expect(f.warnings, label).toEqual(ref.warnings);
}

describe("issue #87", () => {
  const ref = coxph(time, status, x.map((v) => [v]));

  it("fits as R at scale 1", () => {
    // R 4.5.2, survival: coxph(Surv(1:4, c(1, 0, 1, 1)) ~ c(1, 1.5, 0.5, 1.75))
    expect(Math.abs(ref.coefficients[0]! / -1.550270482443556 - 1)).toBeLessThan(1e-12);
    expect(Math.abs(ref.se[0]! / 1.670010535782863 - 1)).toBeLessThan(1e-12);
  });

  it("keeps a covariate around 1e308 (R: coefficient may be infinite; se 0 at 2^1020)", () => {
    const k = 1022;
    const f = coxph(time, status, x.map((v) => [v * 2 ** k]));
    expectSameTests(f, ref, `2^${k}`);
    expect(f.coefficients[0]).toBe(ref.coefficients[0]! * 2 ** -k);
    expect(f.se[0]).toBe(ref.se[0]! * 2 ** -k);
    expect(f.means[0]).toBe(ref.means[0]! * 2 ** k);
    expect(f.linearPredictors).toEqual(ref.linearPredictors);
  });

  it("keeps a subnormal covariate (R: coefficient may be infinite)", () => {
    // the coefficient, -1.55 2^1060, and its standard error are beyond the doubles; the tests are the same
    const k = -1060;
    const f = coxph(time, status, x.map((v) => [v * 2 ** k]));
    expectSameTests(f, ref, `2^${k}`);
    expect(f.coefficients[0]).toBe(-Infinity);
    expect(f.se[0]).toBe(Infinity);
    expect(f.means[0]).toBe(ref.means[0]! * 2 ** k);
  });

  it("keeps the issue's column of +-1e308 (the sum of absolute deviations overflowed)", () => {
    // (against 2, -2, 0: a column of -1, 0 and 1 only is neither centred nor scaled, as R's nocenter)
    const small = coxph([1, 2, 3], [1, 0, 1], [[2], [-2], [0]]);
    const big = coxph([1, 2, 3], [1, 0, 1], [[2 ** 1023], [-(2 ** 1023)], [0]]);
    expectSameTests(big, small, "2^1023");
    expect(big.coefficients[0]).toBe(small.coefficients[0]! * 2 ** -1022);
  });

  it("keeps a huge column beside an ordinary one, and init in the covariate's units", () => {
    const x2 = [0.3, -0.2, 0.9, 0.1];
    const small = coxph(time, status, x.map((v, i) => [v, x2[i]!]), { init: [-1, 0.5] });
    const big = coxph(time, status, x.map((v, i) => [v * 2 ** 1022, x2[i]!]), { init: [-1 * 2 ** -1022, 0.5] });
    expectSameTests(big, small, "two columns");
    expect(big.coefficients).toEqual([small.coefficients[0]! * 2 ** -1022, small.coefficients[1]]);
    expect(big.se).toEqual([small.se[0]! * 2 ** -1022, small.se[1]]);
  });
});
