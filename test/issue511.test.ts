// Issue #511: qexp with rate = Infinity at the endpoints. Not reproduced: the early return in qexp1 passes only NaN
// and 0, so the endpoints reach -log(...) / Inf = Inf / Inf = NaN, as R 4.5.2 (which gives NaN with a warning).
import { describe, expect, it } from "vitest";
import { qexp } from "../src/index.js";

describe("issue 511", () => {
  it("qexp with rate = Inf is NaN at the infinite endpoint, as R", () => {
    expect(qexp(1, { rate: Infinity })).toBeNaN();
    expect(qexp(0, { rate: Infinity, lowerTail: false })).toBeNaN();
    expect(qexp(0, { rate: Infinity, logP: true })).toBeNaN();
    expect(qexp(-Infinity, { rate: Infinity, lowerTail: false, logP: true })).toBeNaN();
  });
  it("qexp with rate = Inf is 0 inside and at p = 0, as R", () => {
    expect(qexp(0, { rate: Infinity })).toBe(0);
    expect(qexp(0.5, { rate: Infinity })).toBe(0);
  });
});
