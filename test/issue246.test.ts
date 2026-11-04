// Issue #246: a coordinate of 0 with zeroTol 0 has a step of 0; grad, jacobian and hessian throw (the check of #213),
// while nonzero coordinates with zeroTol 0 keep working (numDeriv: an error from grad's check of f, NaN from jacobian
// and hessian).
import { describe, expect, it } from "vitest";
import { grad, hessian, jacobian } from "../src/index.js";

describe("issue #246", () => {
  it("a step of 0 is an error for all three", () => {
    const message = "the step for x[0] is 0: not a nonzero finite number";
    expect(() => grad((x) => x[0]! * x[0]!, [0], { zeroTol: 0 })).toThrow(message);
    expect(() => jacobian((x) => [x[0]! * x[0]!], [0], { zeroTol: 0 })).toThrow(message);
    expect(() => hessian((x) => x[0]! * x[0]!, [0], { zeroTol: 0 })).toThrow(message);
  });

  it("a nonzero coordinate with zeroTol 0 keeps its value", () => {
    // the value before the change
    expect(grad((x) => x[0]! * x[0]!, [1], { zeroTol: 0 })).toEqual([1.9999999999870133]);
  });
});
