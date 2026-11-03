// Issue #354: optim checks every point at which fn (and an analytic gr) is evaluated, as R's fminfn and fmingr;
// an infinite start trapped Nelder-Mead's simplex set-up in a loop that never ended. R 4.5.2 gives "non-finite value
// supplied by optim" for each case below.
import { describe, expect, it } from "vitest";
import { optim, optimHess } from "../src/index.js";

const MESSAGE = "non-finite value supplied by optim";
const zero = () => 0;

describe("issue #354", () => {
  // (before the fix this loops forever: excluded from the stash check with -t)
  it("hang: Nelder-Mead with an infinite start", () => {
    expect(() => optim([Infinity], zero)).toThrow(MESSAGE);
    expect(() => optim([1, -Infinity], zero, { method: "Nelder-Mead" })).toThrow(MESSAGE);
  });

  it("the other methods with an infinite or NaN start", () => {
    for (const method of ["BFGS", "SANN"] as const) {
      expect(() => optim([Infinity], zero, { method, control: { maxit: 10 } })).toThrow(MESSAGE);
      expect(() => optim([1, NaN], zero, { method, control: { maxit: 10 } })).toThrow(MESSAGE);
    }
  });

  it("optimHess with an analytic gradient at an infinite point", () => {
    expect(() => optimHess([Infinity], (x) => x[0]! ** 2, (x) => [2 * x[0]!])).toThrow(MESSAGE);
  });

  it("finite starts are unchanged", () => {
    const rosen = (x: number[]) => 100 * (x[1]! - x[0]! ** 2) ** 2 + (1 - x[0]!) ** 2;
    expect(optim([-1.2, 1], rosen).par).toEqual([1.0002601387256695, 1.000505999303765]);
    expect(optim([-1.2, 1], rosen, { method: "BFGS" }).counts).toEqual([118, 38]);
  });
});
