// Issue #248: optim's and optimHess's fnscale +-Infinity throw (R 4.5.2 returns the start with value NaN and
// convergence 0); the other invalid controls of the issue already throw, as in R.
import { describe, expect, it } from "vitest";
import { optim, optimHess } from "../src/index.js";

const f = (x: number[]) => x[0]! ** 2;

describe("issue #248", () => {
  it("fnscale +-Infinity is an error", () => {
    for (const fnscale of [Infinity, -Infinity]) {
      for (const method of ["BFGS", "Nelder-Mead", "Brent"] as const) {
        const extra = method === "Brent" ? { lower: -10, upper: 10 } : {};
        expect(() => optim([1], f, { method, ...extra, control: { fnscale } })).toThrow("'fnscale' must not be infinite");
      }
      expect(() => optimHess([1], f, undefined, { fnscale })).toThrow("'fnscale' must not be infinite");
    }
  });

  it("the issue's examples throw as in R", () => {
    expect(() => optim([1], f, { method: "BFGS", control: { parscale: [0] } })).toThrow();
    expect(() => optim([1], f, { method: "BFGS", control: { fnscale: 0 } })).toThrow("initial value in 'vmmin' is not finite");
    expect(() => optim([1], f, { method: "BFGS", control: { ndeps: [0] } })).toThrow("non-finite finite-difference value [1]");
  });
});
