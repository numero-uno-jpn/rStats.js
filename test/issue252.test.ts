// Issue #252: optim's Brent method does not use control.maxit. R's optim does not either: it calls optimize with
// tol = reltol, and the result is the same with maxit 1 (7 evaluations, counts NA, convergence 0).
import { describe, expect, it } from "vitest";
import { optim } from "../src/index.js";

const run = (control: { maxit?: number }) => {
  let evals = 0;
  const o = optim([0], (x) => (evals++, (x[0]! - 0.123456789) ** 2), { method: "Brent", lower: -1, upper: 1, control });
  return { o, evals };
};

describe("issue #252", () => {
  it("maxit 1 gives R's result, the same as the default", () => {
    const one = run({ maxit: 1 });
    const def = run({});
    // R 4.5.2: par 0x1.f9add3739635fp-4 (0.123456789), value 0, counts NA NA, convergence 0, 7 evaluations
    expect(one.o.par[0]).toBe(0.123456789);
    expect(one.o.value).toBe(0);
    expect(one.o.convergence).toBe(0);
    expect(one.evals).toBe(7);
    expect(def.o.par).toEqual(one.o.par);
    expect(def.evals).toBe(7);
  });
});
