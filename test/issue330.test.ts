import { describe, expect, it } from "vitest";
import { pretty } from "../src/index.js";

// #330: pretty did not check shrinkSml, highUBias and u5Bias. A NaN shrinkSml left the unit NaN and the search for a
// finite multiple of it did not end; the other invalid values gave break points. R rejects them before computing.
describe("pretty: shrinkSml and the biases are checked as in R (#330)", () => {
  it("rejects a non-positive or infinite shrinkSml and negative or non-finite biases", () => {
    for (const shrinkSml of [0, -1, Infinity]) {
      expect(() => pretty([0, 0], { shrinkSml })).toThrow("invalid 'shrink.sml' argument");
      expect(() => pretty([1, 5], { shrinkSml })).toThrow("invalid 'shrink.sml' argument");
    }
    for (const v of [-1, NaN, Infinity]) {
      expect(() => pretty([1, 5], { highUBias: v })).toThrow("invalid 'high.u.bias' argument");
      expect(() => pretty([1, 5], { u5Bias: v })).toThrow("invalid 'u5.bias' argument");
    }
  });

  // This call did not end before the fix
  it("rejects a NaN shrinkSml", () => {
    expect(() => pretty([0, 0], { shrinkSml: NaN })).toThrow("invalid 'shrink.sml' argument");
    expect(() => pretty([1, 5], { shrinkSml: NaN })).toThrow("invalid 'shrink.sml' argument");
  });

  it("keeps the values R gives for valid arguments", () => {
    expect(pretty([0, 0], { shrinkSml: 0.5 })).toEqual([-0.5, 0]);
    expect(pretty([3, 3], { shrinkSml: 0.25 })).toEqual([2, 3]);
    expect(pretty([1, 5], { highUBias: 0 })).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(pretty([1, 5], { u5Bias: 0 })).toEqual([1, 2, 3, 4, 5]);
  });
});
