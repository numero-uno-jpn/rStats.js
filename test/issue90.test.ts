// Issue #90: the Mersenne-Twister position of a restored state: 0 regenerates as in R, and a position beyond the
// signed 32-bit range (which getRandomSeed cannot return) is refused (review_fix_log_issue90.md).
import { describe, expect, it } from "vitest";
import { getRandomSeed, runif, setRandomSeed, setSeed } from "../src/index.js";

const state = (position: number): number[] => [10403, position, ...new Array<number>(624).fill(1)];

describe("issue #90", () => {
  it("regenerates at position 0, as R", () => {
    // R 4.5.2: .Random.seed <- c(10403L, 0L, rep(1L, 624)); runif(2); .Random.seed[2]
    setRandomSeed(state(0));
    expect(getRandomSeed()[1]).toBe(0);
    expect(runif(2)).toEqual([0.9954821162391454, 0.9954821162391454]);
    expect(getRandomSeed()[1]).toBe(2);
    setRandomSeed(state(624));
    expect(runif(2)).toEqual([0.9954821162391454, 0.9954821162391454]);
  });

  it("keeps the positions R keeps", () => {
    // R: position 1 reads word 1 (0.00097659626044332981), 2147483647 regenerates
    setRandomSeed(state(1));
    expect(runif(1)[0]).toBe(0.00097659626044332981);
    setRandomSeed(state(2 ** 31 - 1));
    expect(runif(2)).toEqual([0.9954821162391454, 0.9954821162391454]);
  });

  it("refuses a position beyond 2^31 - 1, leaving the generator as it was", () => {
    for (const position of [2 ** 31, 2 ** 32, -1]) {
      setSeed(1);
      const before = getRandomSeed();
      expect(() => setRandomSeed(state(position)), String(position)).toThrow(RangeError);
      expect(getRandomSeed(), String(position)).toEqual(before);
    }
  });

  it("round-trips a state through getRandomSeed", () => {
    setRandomSeed(state(0));
    const snapshot = getRandomSeed();
    const first = runif(3);
    setRandomSeed(snapshot);
    expect(runif(3)).toEqual(first);
  });
});
