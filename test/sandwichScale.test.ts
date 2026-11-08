// vcovHC, vcovCL, coeftest and coefci for data far from 1 (the numerical audit of 1.3.0): weights, responses and
// columns beyond the range where the plain sandwich overflows or underflows, standard errors that are representable
// where the covariance is not, 1 - h without cancellation, and the argument checks added with them. The references are
// the same fits in units near 1 (powers of 2 are exact, so the values scale exactly), closed forms and exact rationals.
import { describe, expect, it } from "vitest";
import { coefci, coeftest, glm, lm, vcovCL, vcovHC, type RobustFit, type VcovResult } from "../src/index.js";
import { matrixError } from "./helpers/robust.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const x = [1.2, 2.3, 2.9, 4.1, 5.5, 6.2, 7.4, 8.1, 9.3, 10.2];
const y = [2.1, 3.8, 4.2, 6.9, 8.1, 9.9, 10.2, 13.5, 13.1, 16.8];
const g = ["a", "a", "b", "b", "b", "c", "c", "d", "d", "d"];
const w = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1.5];
/** 2^k exactly for |k| up to 2046 */
const P = (k: number): number => 2 ** (k / 2) * 2 ** (k / 2);
const se = (V: number[][]): number[] => V.map((r, i) => Math.sqrt(r[i]!));
const ldexp = (v: number, k: number): number => v * P(k);
const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);
const worstRel = (a: number[], b: number[]): number => Math.max(...a.map((v, i) => rel(v, b[i]!)));

describe("weights far from 1 (lm)", () => {
  // V does not depend on a common factor of the weights; the fits are identical. Before: the zero matrix below 2^-540,
  // NaN or Infinity from 2^510, and a false "hat values of 1" error from 2^515. The sandwich is then formed in units of
  // powers of 2 (rounded otherwise than the plain one: 1e-13, a few ulps of each of its sums)
  const ref = lm(x, y, { weights: w });
  for (const k of [-1000, -540, -530, -520, 510, 515, 1000]) {
    it(`weights × 2^${k}`, () => {
      const f = lm(x, y, { weights: w.map((v) => v * P(k)) });
      for (const type of ["HC0", "HC1", "HC3", "HC5"] as const) {
        expect(matrixError(vcovHC(f, { type }).vcov, vcovHC(ref, { type }).vcov), type).toBeLessThan(1e-13);
      }
      for (const type of ["HC0", "HC1", "HC2", "HC3"] as const) {
        expect(matrixError(vcovCL(f, { type, cluster: g }).vcov, vcovCL(ref, { type, cluster: g }).vcov), `CL ${type}`).toBeLessThan(1e-13);
      }
      // an omega given in units of its own (e^2 2^k): V = A (sum omega x x') A, A = (X'WX)^-1, is 2^-2k 2^k times that of
      // the reference
      if (Math.abs(k) === 1000) {
        const V = vcovHC(f, { omega: f.residuals.map((r) => ldexp(r * r, k)) }).vcov;
        const V0 = vcovHC(ref, { omega: ref.residuals.map((r) => r * r) }).vcov.map((r) => r.map((v) => ldexp(v, -k)));
        expect(matrixError(V, V0), "omega").toBeLessThan(1e-13);
      }
    });
  }

  it("weights × c, by the scale-invariance check", () => {
    expectScaleInvariant(
      "vcovHC/vcovCL weights",
      (c) => lm(x, y, { weights: w.map((v) => v * c) }),
      {
        unitless: (f) => [...vcovHC(f).vcov.flat(), ...vcovCL(f, { cluster: g, type: "HC2" }).vcov.flat(), ...coeftest(f, { vcov: vcovHC }).pValue],
      },
      1e-12,
    );
  });
});

describe("responses far from 1", () => {
  it("lm: vcovHC and vcovCL scale by c^2, coeftest and coefci by c (the scale-invariance check)", () => {
    expectScaleInvariant(
      "lm",
      (c) => lm(x, y.map((v) => v * c)),
      {
        squared: (f) => [...vcovHC(f).vcov.flat(), ...vcovCL(f, { cluster: g }).vcov.flat()],
        units: (f) => [...coeftest(f, { vcov: vcovHC }).stdError, ...coefci(f, { vcov: (ff) => vcovCL(ff, { cluster: g }) }).lower],
        unitless: (f) => [...coeftest(f).statistic, ...coeftest(f, { vcov: (ff) => vcovCL(ff, { type: "HC3", cluster: g }) }).pValue],
      },
      1e-13,
    );
  });

  it("gaussian glm: vcovHC and vcovCL on the scaled fit, exact (before: Infinity from y × 2^260, 0 below 2^-300)", () => {
    const f0 = glm(x, y);
    for (const k of [-500, -300, 260, 300, 500]) {
      const f = glm(
        x,
        y.map((v) => v * P(k)),
      );
      const s = P(2 * k);
      for (const type of ["HC0", "HC3", "const"] as const) expect(vcovHC(f, { type }).vcov, `${k} ${type}`).toEqual(vcovHC(f0, { type }).vcov.map((r) => r.map((v) => v * s)));
      for (const type of ["HC0", "HC1", "HC3"] as const) {
        expect(vcovCL(f, { type, cluster: g }).vcov, `${k} CL ${type}`).toEqual(vcovCL(f0, { type, cluster: g }).vcov.map((r) => r.map((v) => v * s)));
      }
      expect(coeftest(f, { vcov: vcovHC }).statistic).toEqual(coeftest(f0, { vcov: vcovHC }).statistic);
    }
    expectScaleInvariant(
      "gaussian glm",
      (c) =>
        glm(
          x,
          y.map((v) => v * c),
        ),
      {
        squared: (f) => [...vcovHC(f, { type: "HC0" }).vcov.flat(), ...vcovCL(f, { cluster: g }).vcov.flat()],
        units: (f) => coeftest(f, { vcov: (ff) => vcovCL(ff, { type: "HC2", cluster: g }) }).stdError,
        unitless: (f) => coeftest(f, { vcov: vcovHC }).statistic,
      },
      1e-14,
    );
  });

  it("y × 2^±1000: the covariance is not representable, the standard errors are (M1)", () => {
    const f0 = lm(x, y);
    const g0 = glm(x, y);
    for (const k of [1000, -1000]) {
      const f = lm(
        x,
        y.map((v) => v * P(k)),
      );
      const gf = glm(
        x,
        y.map((v) => v * P(k)),
      );
      const vcovs: [string, ((fit: RobustFit) => VcovResult) | undefined][] = [
        ["default", undefined],
        ["HC3", (ff) => vcovHC(ff)],
        ["HC0", (ff) => vcovHC(ff, { type: "HC0" })],
        ["CL", (ff) => vcovCL(ff, { cluster: g })],
        ["CL HC3", (ff) => vcovCL(ff, { cluster: g, type: "HC3" })],
      ];
      for (const [name, v] of vcovs) {
        for (const [fit, fit0] of [
          [f, f0],
          [gf, g0],
        ] as const) {
          const t = coeftest(fit, v === undefined ? {} : { vcov: v });
          const t0 = coeftest(fit0, v === undefined ? {} : { vcov: v });
          expect(
            t.stdError,
            `${k} ${name}`,
          ).toEqual(t0.stdError.map((s) => s * P(k)));
          // (the estimates of the lm fit differ in their last bits: its QR is of y scaled by a power of 2 only below 2^-1022 or so)
          expect(worstRel(t.statistic, t0.statistic), `${k} ${name}`).toBeLessThan(1e-15);
          const ci = coefci(fit, v === undefined ? {} : { vcov: v });
          const ci0 = coefci(fit0, v === undefined ? {} : { vcov: v });
          expect(worstRel(ci.lower, ci0.lower.map((l) => l * P(k))), `${k} ${name}`).toBeLessThan(1e-15);
        }
      }
      // the matrix itself holds what doubles can hold
      const V = vcovHC(f).vcov;
      expect(V[1]![1]).toBe(k > 0 ? Infinity : 0);
      // given as the matrix of the result (the same object), the standard errors are kept; a copy is an error (Infinity)
      // or gives se 0 (the value 0 of the copy)
      expect(coeftest(f, { vcov: V }).stdError).toEqual(coeftest(f, { vcov: vcovHC }).stdError);
      if (k > 0) expect(() => coeftest(f, { vcov: V.map((r) => r.slice()) })).toThrow("is not a finite number");
    }
  });

  it("x and y in the same huge or tiny units: unitless slope and standard errors unchanged (H3)", () => {
    const f0 = lm(x, y, { intercept: false });
    const ref = [coeftest(f0).stdError, coeftest(f0, { vcov: (f) => vcovHC(f, { type: "HC0" }) }).stdError, coeftest(f0, { vcov: (f) => vcovCL(f, { cluster: g }) }).stdError];
    for (const k of [520, 600, -540, -600]) {
      const f = lm(
        x.map((v) => v * P(k)),
        y.map((v) => v * P(k)),
        { intercept: false },
      );
      const got = [coeftest(f).stdError, coeftest(f, { vcov: (ff) => vcovHC(ff, { type: "HC0" }) }).stdError, coeftest(f, { vcov: (ff) => vcovCL(ff, { cluster: g }) }).stdError];
      got.forEach((s, i) => expect(worstRel(s, ref[i]!), `${k} ${i}`).toBeLessThan(1e-14));
    }
  });

  it("glm prior weights × 2^±1000 (gaussian, Gamma, quasipoisson): the fits are identical, so are the covariances", () => {
    for (const family of ["gaussian", "Gamma", "quasipoisson"] as const) {
      const yy = family === "quasipoisson" ? [3, 5, 6, 9, 12, 14, 16, 20, 19, 25] : y;
      const f0 = glm(x, yy, { family, weights: w });
      // (with the weights × 2^-1000 the Gamma and quasipoisson fits stop after one iteration, the deviance criterion
      // having the absolute 0.1 of R's: other coefficients, not a matter of the covariance)
      for (const k of family === "gaussian" ? [1000, -1000] : [1000]) {
        const f = glm(x, yy, { family, weights: w.map((v) => v * P(k)) });
        expect(f.coefficients).toEqual(f0.coefficients);
        // (a few ulps: the sums in units of powers of 2 are rounded otherwise)
        for (const type of ["HC0", "HC3"] as const) expect(matrixError(vcovHC(f, { type }).vcov, vcovHC(f0, { type }).vcov), `${family} ${k} ${type}`).toBeLessThan(1e-13);
        expect(matrixError(vcovCL(f, { cluster: g, type: "HC3" }).vcov, vcovCL(f0, { cluster: g, type: "HC3" }).vcov), `${family} ${k} CL`).toBeLessThan(1e-13);
      }
    }
  });

  it("Gamma on the identity link with working weights below the normal range (M3)", () => {
    // y × 1e160: W = 1/mu^2 about 2e-321 (subnormal, about 3 significant digits, so the fit itself, and glmSummary, are
    // that far off): the statistics are finite and as close to those of y × 1e150 as the weights allow
    const ref = glm(
      x,
      y.map((v) => v * 1e150),
      { family: "Gamma", link: "identity" },
    );
    const f = glm(
      x,
      y.map((v) => v * 1e160),
      { family: "Gamma", link: "identity" },
    );
    for (const vcov of [(ff: RobustFit) => vcovHC(ff, { type: "HC0" }), (ff: RobustFit) => vcovCL(ff, { type: "HC1", cluster: g }), (ff: RobustFit) => vcovCL(ff, { type: "HC3", cluster: g })]) {
      expect(worstRel(coeftest(f, { vcov }).statistic, coeftest(ref, { vcov }).statistic)).toBeLessThan(3e-2);
    }
  });
});

describe("1 - h without cancellation (M2)", () => {
  /** Exact HC3 of lm(y ~ x) by rationals: x integers, y doubles (multiples of 2^-60 here) */
  function exactHC3(xs: number[], ys: number[]): number[][] {
    type Q = [bigint, bigint];
    const gcd = (a: bigint, b: bigint): bigint => {
      a = a < 0n ? -a : a;
      b = b < 0n ? -b : b;
      while (b) [a, b] = [b, a % b];
      return a;
    };
    const q = (n: bigint, d = 1n): Q => {
      if (d < 0n) [n, d] = [-n, -d];
      const c = gcd(n, d) || 1n;
      return [n / c, d / c];
    };
    const add = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
    const sub = (a: Q, b: Q): Q => q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
    const mul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
    const div = (a: Q, b: Q): Q => q(a[0] * b[1], a[1] * b[0]);
    const num = (a: Q): number => {
      // a / b to about 80 bits, then rounded
      const neg = a[0] < 0n;
      const n = neg ? -a[0] : a[0];
      if (n === 0n) return 0;
      const sh = BigInt(Math.max(0, 80 - (n.toString(2).length - a[1].toString(2).length)));
      const v = Number((n << sh) / a[1]) / 2 ** Number(sh);
      return neg ? -v : v;
    };
    const X = xs.map((v) => q(BigInt(v)));
    const Y = ys.map((v) => q(BigInt(v * 2 ** 60), 2n ** 60n));
    const z = q(0n);
    const one = q(1n);
    const sx = X.reduce(add, z);
    const sxx = X.reduce((s, v) => add(s, mul(v, v)), z);
    const sy = Y.reduce(add, z);
    const sxy = X.reduce((s, v, i) => add(s, mul(v, Y[i]!)), z);
    const n = q(BigInt(xs.length));
    const det = sub(mul(n, sxx), mul(sx, sx));
    const A = [
      [div(sxx, det), div(sub(z, sx), det)],
      [div(sub(z, sx), det), div(n, det)],
    ];
    const b0 = add(mul(A[0]![0]!, sy), mul(A[0]![1]!, sxy));
    const b1 = add(mul(A[1]![0]!, sy), mul(A[1]![1]!, sxy));
    const M = [
      [z, z],
      [z, z],
    ];
    X.forEach((v, i) => {
      const r = [one, v];
      const e = sub(Y[i]!, add(b0, mul(b1, v)));
      const t = [add(A[0]![0]!, mul(A[0]![1]!, v)), add(A[1]![0]!, mul(A[1]![1]!, v))];
      const omh = sub(one, add(t[0]!, mul(t[1]!, v)));
      const o = div(mul(e, e), mul(omh, omh));
      for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) M[a]![c] = add(M[a]![c]!, mul(o, mul(r[a]!, r[c]!)));
    });
    const AM = [0, 1].map((a) => [0, 1].map((c) => add(mul(A[a]![0]!, M[0]![c]!), mul(A[a]![1]!, M[1]![c]!))));
    return [0, 1].map((a) => [0, 1].map((c) => num(add(mul(AM[a]![0]!, A[0]![c]!), mul(AM[a]![1]!, A[1]![c]!)))));
  }

  it("HC3 with a leverage row matches the exact value far better than eps / (1 - h)", () => {
    // (the rest of the error is the fit's: the residual of the leverage row carries an absolute error of about eps |y|,
    // which HC0 shows too). Before: 9.1e-12 for big = 2^10 and 3.2e-8 for 2^16
    for (const [big, tol] of [
      [2 ** 10, 2e-12],
      [2 ** 16, 1e-9],
    ] as const) {
      const xs = [0, 1, 2, 3, 4, 5, 6, big];
      const ys = [1.3, 2.1, 2.9, 4.2, 4.8, 6.3, 6.8, big + 0.7];
      expect(matrixError(vcovHC(lm(xs, ys)).vcov, exactHC3(xs, ys)), `big ${big}`).toBeLessThan(tol);
    }
  });
});

describe("argument checks", () => {
  it("HC1 with as many observations as coefficients is an error (R: a matrix of NaN)", () => {
    const f = lm([1, 2], [1, 3]);
    expect(() => vcovCL(f)).toThrow("HC1 covariances need more observations than coefficients");
    expect(() => vcovHC(f, { type: "HC1" })).toThrow("HC1 covariances need more observations than coefficients");
    // HC0 is the zero matrix (the residuals are 0), as R's
    expect(vcovHC(f, { type: "HC0" }).vcov).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it("coeftest and coefci reject a covariance whose diagonal is NaN or infinite; only the diagonal is used", () => {
    const f = lm(x, y);
    for (const V of [
      [
        [NaN, 0],
        [0, 1],
      ],
      [
        [Infinity, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [0, -Infinity],
      ],
    ]) {
      expect(() => coeftest(f, { vcov: V })).toThrow(RangeError);
      expect(() => coefci(f, { vcov: V })).toThrow(RangeError);
    }
    expect(() =>
      coeftest(f, {
        vcov: [
          [1, 0, 0],
          [0, 1, 0],
        ],
      }),
    ).toThrow(RangeError);
    // not symmetric, NaN off the diagonal: the standard errors are those of the diagonal
    expect(
      coeftest(f, {
        vcov: [
          [1, 5],
          [NaN, 4],
        ],
      }).stdError,
    ).toEqual([1, 2]);
  });

  it("a cluster of one row among larger ones has the singularity threshold of the larger blocks (as sandwich's eigenvalues)", () => {
    // 1 - h of the leverage row is 9.9e-14, below eps^(1/1.3) = 9.1e-13: singular alone as when paired
    const big = 2 ** 24;
    const f = lm([0, 1, 2, 3, 4, 5, 6, big], [1.3, 2.1, 2.9, 4.2, 4.8, 6.3, 6.8, big + 0.7]);
    for (const cluster of [
      ["a", "a", "b", "b", "c", "c", "d", "e"],
      ["a", "a", "b", "b", "c", "c", "d", "d"],
    ]) {
      expect(() => vcovCL(f, { type: "HC3", cluster })).toThrow("is singular");
    }
    // one row per cluster everywhere (G = n): the hat values themselves (no threshold), as sandwich
    expect(() => vcovCL(f, { type: "HC3" })).not.toThrow();
  });

  it("cluster labels in a typed array", () => {
    const f = lm(x, y);
    const labels = [1, 1, 2, 2, 2, 3, 3, 4, 4, 4];
    expect(vcovCL(f, { cluster: Float64Array.from(labels) }).vcov).toEqual(vcovCL(f, { cluster: labels }).vcov);
    expect(vcovCL(f, { cluster: [Int32Array.from(labels), g] }).vcov).toEqual(vcovCL(f, { cluster: [labels, g] }).vcov);
  });
});
