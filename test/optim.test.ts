// optim (Nelder-Mead, BFGS, CG, L-BFGS-B, Brent) and its hessian against R (oracle/optim.R; rules in
// oracle/optim-behaviour.md, "Accuracy")
import { describe, expect, it } from "vitest";
import { optim, optimHess } from "../src/index.js";
import { OPT_FNS, compare, loadOptimFixture, runCase } from "./helpers/optim.js";

const cases = loadOptimFixture("optim");

describe("optim against R", () => {
  const byMethod = new Map<string, { cases: number; maxErr: number }>();
  cases.forEach((c, k) => {
    const name = `${k}: ${c.args.fn as string} ${c.args.method as string}${c.args.gradient === true ? " gr" : ""} ${JSON.stringify(c.args.control ?? {})}`;
    it(name, () => {
      const r = runCase(c.args);
      const { failures, maxErr } = compare(c, r);
      const m = byMethod.get(c.args.method as string) ?? { cases: 0, maxErr: 0 };
      byMethod.set(c.args.method as string, { cases: m.cases + 1, maxErr: Math.max(m.maxErr, maxErr) });
      expect(failures).toEqual([]);
    });
  });
  it("summary", () => {
    for (const [m, s] of byMethod) console.log(`optim ${m}: ${s.cases} cases, max error ${s.maxErr.toExponential(2)}`);
  });
});

describe("optim arguments", () => {
  const rosen = OPT_FNS.rosenbrock!.fn;
  it("warns and uses L-BFGS-B when bounds are given to another method", () => {
    const r = optim([-1.2, 1], rosen, { lower: [-2, -2], upper: [0.5, 2] });
    expect(r.warnings).toEqual(["bounds can only be used with method L-BFGS-B (or Brent)"]);
    expect(r.message).toBe("CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL");
    expect(r.par[0]).toBe(0.5);
  });
  it("warns for one-dimensional Nelder-Mead and for reltol with L-BFGS-B", () => {
    expect(optim([1], (x) => (x[0]! - 2) ** 2).warnings).toEqual([
      'one-dimensional optimization by Nelder-Mead is unreliable:\nuse "Brent" or optimize() directly',
    ]);
    expect(optim([1, 1], rosen, { method: "L-BFGS-B", control: { reltol: 1e-10 } }).warnings).toEqual([
      "method L-BFGS-B uses 'factr' (and 'pgtol') instead of 'reltol' and 'abstol'",
    ]);
  });
  it("errors as R", () => {
    expect(() => optim([1, 2], rosen, { method: "Brent", lower: 0, upper: 1 })).toThrow(
      'method = "Brent" is only available for one-dimensional optimization',
    );
    expect(() => optim([1], (x) => x[0]!, { method: "Brent" })).toThrow("'lower' and 'upper' must be finite values");
    expect(() => optim([1, 2], () => NaN, { method: "L-BFGS-B" })).toThrow("L-BFGS-B needs finite values of 'fn'");
    expect(() => optim([1, 2], () => Infinity, { method: "BFGS" })).toThrow("initial value in 'vmmin' is not finite");
    expect(() => optim([1, 2], () => NaN, { method: "CG" })).toThrow("function cannot be evaluated at initial parameters");
    expect(() => optim([1, 2], (x) => (x[0]! > 1.0005 ? NaN : x[0]!), { method: "BFGS" })).toThrow("non-finite finite-difference value [1]");
  });
  it("optimHess equals the hessian of optim", () => {
    const c = cases.find((c) => c.args.method === "Nelder-Mead" && c.args.hessian === true && c.args.fn === "rosenbrock")!;
    const r = runCase(c.args);
    expect(optimHess(r.par, rosen)).toEqual(r.hessian);
  });
  it("L-BFGS-B with no parameters", () => {
    const r = optim([], () => 3, { method: "L-BFGS-B" });
    expect(r.message).toBe("NOTHING TO DO");
    expect(r.value).toBe(3);
  });
});
