// Issue #204: esW1 and esW2 add 0 for a cell where both probabilities are 0 (review 33, deliberate; pwr gives NaN).
import { describe, expect, it } from "vitest";
import { esW1, esW2 } from "../src/index.js";

describe("issue #204", () => {
  it("cells with both probabilities 0 add nothing (pwr 1.3.0: NaN)", () => {
    expect(esW1([0, 1], [0, 1])).toBe(0);
    expect(esW2([[0, 0], [0, 1]])).toBe(0);
    expect(esW1([0.5, 0.5, 0], [0.5, 0.5, 0])).toBe(0);
  });

  it("p0 = 0 < p1 is still Infinity, as pwr", () => {
    expect(esW1([0, 1], [0.5, 0.5])).toBe(Infinity);
  });
});
