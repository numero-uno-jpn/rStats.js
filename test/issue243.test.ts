// Issue #243: distSummary("triang") formed q = a² + b² + c² - ab - ac - bc from the parameters, which overflows to
// Inf - Inf near the top of the range (variance and skewness NaN for a = 1e308) and cancels wherever the location is
// large against the width (variance 910 for (1e10, 1e10 + 1, 1e10 + 0.25), true 0.045). The variance and skewness
// now come from the differences, q = (b - a)(b - c) + (c - a)² (review_fix_log_issue243.md). References: Rmpfr
// (400 bits) on the exact doubles.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const T = (a: number, b: number, c: number) => distSummary("triang", { a, b, c });
const ULP = 2 ** 971; // spacing of the doubles near 1e308

describe("issue #243", () => {
  it("gives variance Infinity, the finite sd and skewness 0 for the issue's symmetric triangle", () => {
    const s = T(1e308, 1.0000000000000004e308, 1.0000000000000002e308);
    expect(s.variance).toBe(Infinity);
    expect(s.sd).toBe(8.147983944064166e291); // Rmpfr 8.1479839440641656e291
    expect(s.skewness).toBe(0);
  });

  it("agrees with Rmpfr for asymmetric triangles with large locations", () => {
    const r = T(1e300, 1.0000000000000003e300, 1e300);
    expect(r.variance).toBe(Infinity);
    expect(r.sd).toBe(7.009864931491307e283); // Rmpfr 7.0098649314913074e283
    expect(r.skewness).toBe(0.565685424949238); // Rmpfr 0.56568542494923802
    const n = T(1e10, 1e10 + 1, 1e10 + 0.25);
    expect(n.variance).toBe(0.04513888888888889); // Rmpfr 0.045138888888888889 (was 910.2222222222222)
    expect(n.sd).toBe(0.21245914639969937);
    expect(n.skewness).toBe(0.4224039833745502); // Rmpfr 0.42240398337455022 (was 1.475e-7)
  });

  it("keeps the skewness under translation", () => {
    const base = T(0, 4, 1);
    expect(base.skewness).toBe(0.4224039833745502);
    expect(T(1e308, 1e308 + 4 * ULP, 1e308 + ULP).skewness).toBe(base.skewness);
    expect(T(1e10, 1e10 + 4, 1e10 + 1).skewness).toBe(base.skewness);
    expect(T(1e10, 1e10 + 4, 1e10 + 1).variance).toBe(base.variance);
    expect(T(1e308, 1e308 + 4 * ULP, 1e308 + ULP).sd).toBe(1.6961381140554334e292);
  });

  it("keeps the skewness where the width is tiny and q^1.5 would be subnormal", () => {
    const x = 2 ** -299;
    // Node 22's Math.pow gives 0.30544141932848506 (1 ulp), Node 24 and later 0.305441419328485
    const skewness = T(x, x * (1 + 3 * Number.EPSILON), x * (1 + Number.EPSILON)).skewness;
    expect(Math.abs(skewness / 0.305441419328485 - 1)).toBeLessThan(4e-15);
  });

  it("keeps the values of the fixture's triangles", () => {
    expect(T(0, 1, 0.5)).toMatchObject({ variance: 0.041666666666666664, sd: 0.2041241452319315, skewness: 0 });
    expect(T(-1, 3, 0)).toMatchObject({ variance: 0.7222222222222222, sd: 0.8498365855987975, skewness: 0.4224039833745502 });
    expect(T(0, 2, 2)).toMatchObject({ variance: 0.2222222222222222, sd: 0.4714045207910317, skewness: -0.565685424949238 });
    expect(T(-1e308, 1e308, 0)).toMatchObject({ variance: Infinity, sd: 4.08248290463863e307, skewness: 0 });
  });
});
