// Issue #408: rweibull where (-log u)^(1/shape) overflows although the variate is in range for a small scale. R 4.5.2:
// set.seed(19); rweibull(1, 0.001, 2^-1074) is Inf (1 uniform, 0x1.dfc4518p-4, drawn). The value for R's e = -log(u)
// (0x1.127ddb902d7a3p+1), from Rmpfr: 2^-1074 e^1000 = 103020481.12806690190 (0x1.88fdf048323f8p+26); shape 0.00105:
// 2^-1074 e^(1/0.00105) = 1.7211618870375898655e-8 (0x1.27b1801530376p-26). The power is now taken in logs
// (double-double) only where it overflows (review_fix_log_issue408.md).
import { describe, expect, it } from "vitest";
import { rweibull, runif, setSeed } from "../src/index.js";

/** A C99 hex float as R's sprintf("%a") prints it (normal numbers) */
const hex = (h: string): number => {
  const [, m, e] = /^0x1\.([0-9a-f]*)p([-+]\d+)$/.exec(h)!;
  return Number(BigInt(`0x1${m}`)) * 2 ** (Number(e) - 4 * m!.length);
};

describe("issue #408", () => {
  it("gives the variate in range where the power overflows, drawing one uniform", () => {
    setSeed(19);
    runif(1);
    const next = runif(1)[0];
    setSeed(19);
    expect(rweibull(1, 0.001, { scale: Number.MIN_VALUE })).toEqual([hex("0x1.88fdf048323f8p+26")]);
    expect(runif(1)[0]).toBe(next);
    setSeed(19);
    expect(rweibull(1, 0.00105, { scale: Number.MIN_VALUE })).toEqual([hex("0x1.27b1801530376p-26")]);
  });

  it("keeps a true overflow", () => {
    setSeed(19);
    expect(rweibull(1, 0.001)).toEqual([Infinity]);
    setSeed(19);
    expect(rweibull(1, 0.0005, { scale: Number.MIN_VALUE })).toEqual([Infinity]);
  });
});
