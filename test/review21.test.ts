// Fixes of the 21st review round (review_fix_log_20261031_21.md): draws beyond the largest double are Infinity, with
// R's stream kept.
import { describe, expect, it } from "vitest";
import { rgeom, rnbinom, runif, setSeed } from "../src/index.js";

describe("review 21", () => {
  it("rgeom with a prob so small that the mean overflows", () => {
    setSeed(1);
    expect(rgeom(3, Number.MIN_VALUE)).toEqual([Infinity, Infinity, Infinity]); // R 4.5.2: NA
    expect(runif(1)[0]).toBeCloseTo(0.908207789994776, 15); // R's next uniform
    setSeed(1);
    expect(rgeom(1, 1e-300)[0]).toBeCloseTo(7.55181833128345e299, -286); // unchanged
  });
  it("rnbinom with size = Inf and a fixed prob", () => {
    setSeed(1);
    expect(rnbinom(3, Infinity, { prob: 0.5 })).toEqual([Infinity, Infinity, Infinity]); // R 4.5.2: about 9e307
    expect(runif(1)[0]).toBeCloseTo(0.769841419998556, 15); // R's next uniform
    expect(rnbinom(2, Infinity, { prob: 1 })).toEqual([0, 0]);
  });
});
