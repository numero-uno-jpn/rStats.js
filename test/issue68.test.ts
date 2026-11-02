// Issue #68: dmultinom where a ratio p_k / (p_k + ... + p_K) is below the normal range (review_fix_log_issue68.md).
import { describe, expect, it } from "vitest";
import { dmultinom } from "../src/index.js";

const M = Number.MIN_VALUE;

function rel(v: number, ref: number): number {
  return v === ref ? 0 : Math.abs(v - ref) / Math.abs(ref);
}

describe("issue #68", () => {
  it("gives the finite log probability where a weight is tiny beside an overflowing sum", () => {
    // p_1 = 5e-324 / (5e-324 + 3.4e308): log p_1 = log(5e-324) - log(1.7e308) - log 2
    const lp1 = Math.log(M) - Math.log(1.7e308) - Math.LN2;
    expect(rel(dmultinom([1, 0, 0], [M, 1.7e308, 1.7e308], { log: true }), lp1)).toBeLessThanOrEqual(1e-15);
    expect(dmultinom([1, 0, 0], [M, 1.7e308, 1.7e308])).toBe(0);
    // 2!/(1! 1!) p_1 p_2 with p_2 = 1/2
    expect(rel(dmultinom([1, 1, 0], [M, 1.7e308, 1.7e308], { log: true }), lp1)).toBeLessThanOrEqual(1e-15);
    // 3!/(2! 1!) p_1² p_2
    const lq = Math.log(1e-310) - Math.log(1.7e308) - Math.LN2;
    expect(rel(dmultinom([2, 1, 0], [1e-310, 1.7e308, 1.7e308], { log: true }), Math.log(3) + 2 * lq - Math.LN2)).toBeLessThanOrEqual(1e-15);
    const lr = Math.log(1e-300) - Math.log(1.7e308) - Math.LN2;
    expect(rel(dmultinom([1, 0, 0], [1e-300, 1.7e308, 1.7e308], { log: true }), lr)).toBeLessThanOrEqual(1e-15);
  });

  it("gives the finite log probability where a ratio underflows without overflow of the sum", () => {
    expect(rel(dmultinom([1, 0, 0], [M, 1, 1], { log: true }), Math.log(M) - Math.LN2)).toBeLessThanOrEqual(1e-15);
    // the tiny weight in a later position: p_3 = 5e-324 / (1 + 5e-324) given the first category
    expect(rel(dmultinom([0, 2, 1], [1, 1, M], { log: true }), Math.log(3) - 3 * Math.LN2 + Math.log(M))).toBeLessThanOrEqual(1e-15);
  });

  it("keeps a weight that the scaling of an overflowing sum takes to 0 (it was dropped from the later ratios)", () => {
    // 3! (1/2)(1/2) p_3 and p_3², p_3 = 5e-324 / 2e308
    const lp3 = Math.log(M) - Math.LN2 - Math.log(1e308);
    expect(rel(dmultinom([1, 1, 1], [1e308, 1e308, M], { log: true }), Math.log(1.5) + lp3)).toBeLessThanOrEqual(1e-15);
    expect(rel(dmultinom([0, 0, 2], [1e308, 1e308, M], { log: true }), 2 * lp3)).toBeLessThanOrEqual(1e-15);
    expect(dmultinom([1, 1, 1], [1e308, 1e308, M])).toBe(0);
    // 1 - q below the normal range: 3!/(1! 2!) p_1 p_3², p_3 = 1e-310 / (1 + 2e-310)
    expect(rel(dmultinom([1, 0, 2], [1, 1e-310, 1e-310], { log: true }), Math.log(3) + 2 * Math.log(1e-310))).toBeLessThanOrEqual(1e-15);
    expect(dmultinom([3, 0, 0], [1, 1e-310, 1e-310])).toBe(1);
  });

  it("keeps zero weights with positive counts at -Infinity and the ordinary values", () => {
    expect(dmultinom([1, 0, 0], [0, 1.7e308, 1.7e308], { log: true })).toBe(-Infinity);
    expect(dmultinom([0, 1, 1], [M, 1.7e308, 1.7e308])).toBe(0.5);
    expect(dmultinom([1, 2, 1], [0.2, 0.5, 0.3])).toBe(0.18000000000000002);
  });
});
