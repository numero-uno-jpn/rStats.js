// Fixes of the 19th review round (review_fix_log_20261031_19.md): invalid parameters of random generators are NaN,
// with R's stream kept.
import { describe, expect, it } from "vitest";
import { getRandomSeed, rgamma, rlogis, runif, rweibull, setRandomSeed, setSeed } from "../src/index.js";

describe("review 19", () => {
  it("rgamma and rweibull: an invalid shape is NaN also with scale 0 (no variate drawn, as in R)", () => {
    setSeed(1);
    expect(rgamma(1, -1, { scale: 0 })).toEqual([NaN]);
    expect(rweibull(2, -1, { scale: 0 })).toEqual([NaN, NaN]);
    expect(rweibull(1, NaN, { scale: 0 })).toEqual([NaN]);
    expect(runif(1)[0]).toBe(0.2655086631421); // R 4.5.2: runif(1) right after set.seed(1)
    expect(rgamma(1, 2, { scale: 0 })).toEqual([0]);
    expect(rweibull(1, 2, { scale: 0 })).toEqual([0]);
  });
  it("rlogis with a negative scale is NaN, drawing R's uniforms", () => {
    setSeed(1);
    expect(rlogis(2, { location: 0, scale: -1 })).toEqual([NaN, NaN]);
    expect(runif(1)[0]).toBeCloseTo(0.572853363351896, 15); // R 4.5.2 after set.seed(1); rlogis(2, 0, -1)
  });
  it("a Mersenne-Twister state with a word beyond 32 bits is refused", () => {
    setSeed(1);
    const s = Array.from(getRandomSeed());
    s[5] = 2 ** 40;
    expect(() => setRandomSeed(s)).toThrow("32-bit integers");
  });
});
