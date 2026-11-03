// Issue #213: grad, jacobian and hessian throw where a step d abs(x[i]) overflows (numDeriv: an error from grad's check
// of f, NaN from jacobian and hessian).
import { describe, expect, it } from "vitest";
import { grad, hessian, jacobian } from "../src/index.js";

describe("issue #213", () => {
  it("a step beyond the doubles is an error for all three", () => {
    const message = "the step for x[0] is Infinity: not a positive finite number";
    expect(() => grad((x) => x[0]! / 1e308, [1e308], { d: 2 })).toThrow(message);
    expect(() => jacobian((x) => [x[0]! / 1e308], [1e308], { d: 2 })).toThrow(message);
    expect(() => hessian((x) => x[0]! / 1e308, [1e308], { d: 2 })).toThrow(message);
  });
});
