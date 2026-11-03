// Issue #224: mantelhaenTest (I x J x K) where t^2 (t - 1) or the covariance products overflow
// (review_fix_log_issue224.md).
import { describe, expect, it } from "vitest";
import { mantelhaenTest } from "../src/index.js";

const equal = (c: number) => Array.from({ length: 3 }, () => [c, c, c]);
const g3 = [[1e103, 2e103, 3e103], [2e103, 1e103, 1e103], [5e102, 3e103, 1e103]];
const g4 = [[2e103, 1e103, 3e103], [1e103, 4e103, 1e103], [5e102, 1e103, 2e103]];
const scaled = (m: number[][], k: number) => m.map((r) => r.map((v) => v * 2 ** k));

describe("issue #224: mantelhaenTest, general covariance with large counts", () => {
  it("gives 0 for balanced strata (was 'exactly singular'; R fails with NA/NaN/Inf in qr)", () => {
    for (const c of [1e103, 1e200, 1e308]) {
      // 1e308: the stratum totals overflow as well
      const r = mantelhaenTest([equal(c), equal(c)]);
      expect(r.statistic).toBe(0);
      expect(r.pValue).toBe(1);
    }
  });

  it("matches the exact statistic for unbalanced strata", () => {
    // exact rational arithmetic (gmp bigq in R) on the doubles: 0x1.c290ca7b8bf48p+343
    const exact = 3.1535997200030353e103;
    const r = mantelhaenTest([g3, g4]);
    expect(Math.abs(r.statistic / exact - 1)).toBeLessThan(1e-15);
    expect(r.parameter).toBe(4);
    expect(r.pValue).toBe(0);
  });

  it("keeps the values where nothing overflows", () => {
    // the same strata divided by 2^300, as before (R: 0x1.c290ca7b8bee1p+43 = 15481315777631.44, 1 ulp apart)
    expect(mantelhaenTest([scaled(g3, -300), scaled(g4, -300)]).statistic).toBe(15481315777631.43);
  });
});
