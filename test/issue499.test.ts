// Issue #499: a negative eps gives a negative step at coordinates near 0; grad, jacobian and hessian (Richardson)
// rejected it as "not a positive finite number". numDeriv takes the differences the other way.
// R values: numDeriv, method.args = list(eps = -1e-4), printed with sprintf("%a").
import { describe, expect, it } from "vitest";
import { grad, hessian, jacobian } from "../src/index.js";

function fromHex(h: string): number {
  const m = /^(-?)0x1\.([0-9a-f]{13})p([+-]\d+)$/.exec(h)!;
  const v = Number.parseInt(`1${m[2]}`, 16) * 2 ** -52 * 2 ** Number(m[3]);
  return m[1] === "-" ? -v : v;
}

describe("issue #499", () => {
  it("x^2 at 0 with eps -1e-4", () => {
    expect(grad((x) => x[0]! * x[0]!, [0], { eps: -1e-4 })).toEqual([0]);
    expect(jacobian((x) => [x[0]! * x[0]!], [0], { eps: -1e-4 })).toEqual([[0]]);
    expect(hessian((x) => x[0]! * x[0]!, [0], { eps: -1e-4 })).toEqual([[2]]);
  });

  // the last digits differ from numDeriv as with a positive eps (grad 2.5e-12, the hessian's diagonal 1.7e-7 here)
  it("two coordinates at 0 match numDeriv", () => {
    const g = (x: number[]) => Math.exp(x[0]!) + Math.sin(x[1]!) * x[0]!;
    const r = grad(g, [0, 0], { eps: -1e-4 });
    expect(r[0]).toBeCloseTo(fromHex("0x1.ffffffffff197p-1"), 11);
    expect(r[1]).toBe(0);
    const j = jacobian((x) => [Math.exp(x[0]!), x[0]! * x[1]! ** 3], [0, 0], { eps: -1e-4 });
    expect(j[0]![0]).toBeCloseTo(fromHex("0x1.ffffffffff197p-1"), 11);
    expect(j[0]![1]).toBe(0);
    expect(j[1]![0]).toBe(0);
    expect(j[1]![1]).toBe(0);
    const h = hessian(g, [0, 0], { eps: -1e-4 });
    expect(h[0]![0]).toBeCloseTo(fromHex("0x1.ffffe5e4e1dbfp-1"), 6);
    expect(h[0]![1]).toBe(fromHex("0x1.0000015832ed9p+0"));
    expect(h[1]![0]).toBe(fromHex("0x1.0000015832ed9p+0"));
    expect(h[1]![1]).toBe(0);
  });
});
