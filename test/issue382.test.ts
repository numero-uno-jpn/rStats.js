import { describe, expect, it } from "vitest";
import { chisqTest } from "../src/index.js";

// #382: the complements 1 - sr / n and 1 - sc / n lost small margins (and O - E the cell of 2^52)
describe("chisqTest stdres in double-double (#382)", () => {
  it("2^52 and 0.1: all four are 2^26 in absolute value (R NaN, -Inf, -Inf, 2^26)", () => {
    for (const correct of [true, false]) {
      const s = chisqTest([[2 ** 52, 0], [0, 0.1]], { correct }).stdres as number[][];
      expect(s).toEqual([
        [67108864, -67108864],
        [-67108864, 67108864],
      ]);
    }
  });

  it("[[1e15, 7], [3, 11]]: the exact value 21912524.50446396208531 (before: 21930052.7 in cell (1,1))", () => {
    const s = chisqTest([[1e15, 7], [3, 11]], { correct: false }).stdres as number[][];
    const v = 0x14e5bcc81248ce / 2 ** 28; // 0x1.4e5bcc81248cep+24
    expect(s).toEqual([
      [v, -v],
      [-v, v],
    ]);
  });
});
