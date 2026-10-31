// Fixes of the 24th review round (review_fix_log_20261031_24.md): the arcsine distribution on intervals whose width
// overflows; quantiles at the median for an infinite scale.
import { describe, expect, it } from "vitest";
import { darcsine, parcsine, qarcsine, qcauchy, qlnorm, qlogis, qnorm } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const W = { a: -1e308, b: 1e308 };

describe("review 24", () => {
  it("parcsine with b - a beyond the largest double", () => {
    expect(parcsine(0, W)).toBe(0.5); // was 0
    expect(rel(parcsine(5e307, W), 2 / 3)).toBeLessThan(1e-15); // was 1
    const p = (2 / Math.PI) * Math.asin(Math.sqrt(0.05));
    expect(rel(parcsine(-9e307, W), p)).toBeLessThan(1e-14); // was 0
    expect(rel(parcsine(-9e307, { ...W, lowerTail: false }), 1 - p)).toBeLessThan(1e-15);
    expect(rel(parcsine(0, { ...W, logP: true }), -Math.LN2)).toBeLessThan(1e-15); // was -Inf
  });
  it("qarcsine with b - a beyond the largest double", () => {
    // 0 within an ulp of the ends (qbeta(0.5, 1/2, 1/2) is 0.5 - 2^-54; qarcsine(0.5, -1, 1) is -1.1e-16 likewise)
    expect(Math.abs(qarcsine(0.5, W))).toBeLessThanOrEqual(2e292); // was Inf
    expect(rel(qarcsine(0.25, W), -1e308 / Math.SQRT2)).toBeLessThan(1e-15); // was Inf
    expect(rel(qarcsine(0.75, W), 1e308 / Math.SQRT2)).toBeLessThan(1e-15); // was -Inf
    expect(rel(qarcsine(0.25, { ...W, lowerTail: false }), 1e308 / Math.SQRT2)).toBeLessThan(1e-15);
    expect(qarcsine(1e-100, W)).toBe(-1e308); // was 1e308, the other end
    expect(qarcsine(1e-100, { ...W, lowerTail: false })).toBe(1e308);
    expect(parcsine(qarcsine(0.3, W), W)).toBeCloseTo(0.3, 14);
  });
  it("darcsine with b - a beyond the largest double", () => {
    expect(rel(darcsine(0, W), 1 / Math.PI / 1e308)).toBeLessThan(1e-12); // 3.2e-309 (subnormal), was 0
    expect(rel(darcsine(0, { ...W, log: true }), -Math.log(Math.PI) - Math.log(1e308))).toBeLessThan(1e-15);
    const l = -Math.log(Math.PI) - 0.5 * (Math.log(1.9) + Math.log(1e308) + Math.log(1e307));
    expect(rel(darcsine(9e307, { ...W, log: true }), l)).toBeLessThan(1e-15); // was -Inf
    expect(rel(darcsine(-9e307, { ...W, log: true }), l)).toBeLessThan(1e-15);
  });
  it("darcsine where pi sqrt(x - a) sqrt(b - x) overflows", () => {
    expect(rel(darcsine(8.5e307, { a: 0, b: 1.7e308 }), 1 / Math.PI / 8.5e307)).toBeLessThan(1e-12); // was 0
    expect(darcsine(0.25, { a: 0, b: 1 })).toBe(1 / (Math.PI * Math.sqrt(0.25) * Math.sqrt(0.75))); // unchanged
  });
  it("quantiles at the median for an infinite scale are the location", () => {
    expect(qnorm(0.5, { mean: 3, sd: Infinity })).toBe(3); // R 4.5.2: NaN
    expect(qnorm(-Math.LN2, { mean: 3, sd: Infinity, logP: true })).toBe(3); // R 4.5.2: NaN
    expect(qnorm(0.3, { mean: 3, sd: Infinity })).toBe(-Infinity); // R 4.5.2: -Inf
    expect(qnorm(0.7, { mean: 3, sd: Infinity })).toBe(Infinity);
    expect(qlnorm(0.5, { meanlog: 0, sdlog: Infinity })).toBe(1); // R 4.5.2: NaN
    expect(qlnorm(0.5, { meanlog: 2, sdlog: Infinity })).toBe(Math.exp(2));
    expect(qlnorm(0.3, { meanlog: 0, sdlog: Infinity })).toBe(0); // R 4.5.2: 0
    expect(qlogis(0.5, { location: 3, scale: Infinity })).toBe(3); // R 4.5.2: NaN
    expect(qlogis(0.5, { location: 3, scale: Infinity, lowerTail: false })).toBe(3);
    expect(qlogis(0.3, { location: 3, scale: Infinity })).toBe(-Infinity); // R 4.5.2: -Inf
  });
  it("qcauchy with an infinite scale gives the limits", () => {
    expect(qcauchy(0.5, { location: 3, scale: Infinity })).toBe(3); // R 4.5.2: NaN
    expect(qcauchy(0.3, { location: 3, scale: Infinity })).toBe(-Infinity); // R 4.5.2: NaN
    expect(qcauchy(0.7, { location: 3, scale: Infinity })).toBe(Infinity);
    expect(qcauchy(0.3, { location: 3, scale: Infinity, lowerTail: false })).toBe(Infinity);
    expect(qcauchy(1e-300, { location: 3, scale: Infinity })).toBe(-Infinity);
    expect(qcauchy(-1000, { location: 3, scale: Infinity, logP: true })).toBe(-Infinity);
    expect(qcauchy(-Math.LN2, { location: 3, scale: Infinity, logP: true })).toBe(3);
  });
});
