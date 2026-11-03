// Issue #355: a non-finite component of an analytic gradient is an error, as the numerical gradient's
// "non-finite finite-difference value [i]". R 4.5.2 does not check gr: an infinite gradient fails with "non-finite
// value supplied by optim" (the trial point becomes infinite; #354 gives the same here), and a NaN one returns the
// start with convergence 0 (BFGS, CG) without a step. The NaN case is a deliberate difference from R.
import { describe, expect, it } from "vitest";
import { optim, optimHess } from "../src/index.js";

const f = (x: number[]) => x[0]! ** 2;
const message = (i: number) => `non-finite value of the gradient [${i}] supplied by 'gr'`;

describe("issue #355", () => {
  it("a NaN or infinite gradient is an error in BFGS, CG and L-BFGS-B", () => {
    for (const method of ["BFGS", "CG", "L-BFGS-B"] as const) {
      for (const g of [NaN, Infinity, -Infinity]) {
        expect(() => optim([1], f, { method, gr: () => [g] })).toThrow(message(1));
      }
    }
  });

  it("the component is named; a NaN later in the path also throws", () => {
    const f2 = (x: number[]) => x[0]! ** 2 + x[1]! ** 2;
    expect(() => optim([1, 1], f2, { method: "BFGS", gr: (x) => [2 * x[0]!, NaN] })).toThrow(message(2));
    expect(() => optim([1], f, { method: "BFGS", gr: (x) => [Math.abs(x[0]!) < 0.5 ? NaN : 2 * x[0]!] })).toThrow(message(1));
  });

  it("optimHess with a NaN gradient", () => {
    expect(() => optimHess([1], f, () => [NaN])).toThrow(message(1));
  });

  it("finite gradients are unchanged", () => {
    const r = optim([1], f, { method: "BFGS", gr: (x) => [2 * x[0]!] });
    expect(r.par[0]).toBe(0);
    expect(r.convergence).toBe(0);
  });
});
