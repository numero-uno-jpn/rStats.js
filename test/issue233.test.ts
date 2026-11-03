// Issue #233: Walker's alias table for 199 weights 0.5 / 201 and two of 50.75 / 201. The table is right (the last
// large entry, left with 0.75, is aliased to the other, which has exactly 1) and the draws are R's.
import { describe, expect, it } from "vitest";
import { runif, sampleInt, setSeed } from "../src/index.js";

const prob = [...Array<number>(199).fill(0.5 / 201), 50.75 / 201, 50.75 / 201];

describe("issue #233", () => {
  it("draws the same values as R and leaves the stream as R", () => {
    setSeed(1);
    // R 4.5.2: set.seed(1); sample.int(201, 20, TRUE, prob); runif(1) = 0x1.62adb5e8p-1
    expect(sampleInt(201, { size: 20, replace: true, prob }).map((v) => v + 1)).toEqual([
      201, 129, 201, 187, 201, 200, 201, 73, 37, 110, 165, 200, 89, 201, 200, 201, 200, 200, 20, 201,
    ]);
    expect(runif(1)[0]).toBe(0x162adb5e8 / 2 ** 33); // 0.6927315564826131
  });

  it("gives candidates 200 and 201 about 50.75 / 201 each", () => {
    setSeed(2);
    const x = sampleInt(201, { size: 200000, replace: true, prob });
    const share = (v: number) => x.filter((y) => y === v - 1).length / x.length; // candidates numbered from 1, as R
    // 0.25249 each; the sd of a share is about 0.001
    expect(Math.abs(share(200) - 50.75 / 201)).toBeLessThan(0.005);
    expect(Math.abs(share(201) - 50.75 / 201)).toBeLessThan(0.005);
  });
});
