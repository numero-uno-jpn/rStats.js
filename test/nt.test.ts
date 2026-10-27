import { describe, expect, it } from "vitest";
import { dt, pnorm, pt, qt } from "../src/index.js";
import { bool, num, relativeError } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral t distribution (when ncp is given)
// The tolerance for the density and CDF is 1e-13. In the deep tails (below 1e-50) the exponents at the
// quadrature nodes of the integral (src/distributions/nt.ts) reach several hundred, and the difference from
// the reference values grows to just under 1e-13 (about 1e-15 near the centre)
const NT_TOL = 1e-13;
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnt",
  tolerance: NT_TOL,
  density: true,
  call: (a) => dt(num(a.x), num(a.df), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnt",
  tolerance: NT_TOL,
  call: (a) => pt(num(a.q), num(a.df), opts(a)),
});
fixtureSuite({
  name: "qnt",
  tolerance: 1e-14,
  // The quantile is undefined for ncp = Inf. R returns NaN or ±Inf depending on p. We return NaN
  knownDifference: (a, _e, x) =>
    Number.isNaN(x) && !Number.isFinite(num(a.ncp)) && !Number.isNaN(num(a.ncp)) ? "ncp = Inf: R returns ±Inf" : undefined,
  call: (a) => qt(num(a.p), num(a.df), opts(a)),
  backward: (a, x) => pt(x, num(a.df), opts(a)),
});

// Reference values from the integral over w = log(U/a) with mpmath at 60 digits
describe("noncentral t: regressions", () => {
  it("builds the larger tail as 1 - (smaller), so that it does not exceed 1", () => {
    const [t, df, ncp] = [3428773.6947873095, 52.80813184100357, 3.6452526524836575];
    const lower = pt(t, df, { ncp }) as number;
    expect(lower).toBeLessThanOrEqual(1);
    expect(lower).toBe(1 - (pt(t, df, { ncp, lowerTail: false }) as number));
  });

  it("gives the values for a huge df (Laplace's method; NaN, Infinity or 7e-9 off in log P before)", () => {
    const cases: [number, number, number, boolean, number][] = [
      // [t, df, ncp, distribution function (else density), log value]
      [-30.268742563306827, 1e17, 2.475805900718761, true, -540.5113325711632],
      [-1e6, 1e8, 0.3, true, -460525028.3505758],
      [-1e6, 1e10, -0.5, true, -23075552844.836792],
      [-1.0440480647904281e26, 100100312298908620, 2.475805900718761, true, -4037830717059146000],
      [2.3074923907795758e54, 100100312298908620, 2.475805900718761, false, -10570921488279050000],
      [-1.2e104, 9.8e28, -0.07, false, -2.0214831295875142e31],
      [-3000, 3e5, -0.5, false, -514831.3729353206],
    ];
    for (const [t, df, ncp, cdf, ref] of cases) {
      const v = cdf ? pt(t, df, { ncp, logP: true }) : dt(t, df, { ncp, log: true });
      expect(relativeError(v as number, ref), `${t}, ${df}, ${ncp}`).toBeLessThanOrEqual(1e-14);
    }
    // the larger tail where the smaller underflows (the tails added up to 1 - 2.2e-15 before), and 0 for Infinity
    expect(pt(-30.268742563306827, 100100312298908620, { ncp: 2.475805900718761, lowerTail: false })).toBe(1);
    expect(pt(-1.0255872288729821e294, 5.791529101318887e33, { ncp: 1e-84 })).toBe(0);
  });

  it("gives the values for a tiny df (formula B throughout; 1.2e-227 for 0.967 before)", () => {
    // S = sqrt(U/a) is all but surely tiny: P[T <= t] = Φ(-δ) for any t not astronomically small or large
    const p = pt(-59193519471.86663, 1.9146506048870366e-245, { ncp: -1.8387038943733192 }) as number;
    expect(relativeError(p, pnorm(1.8387038943733192) as number)).toBeLessThanOrEqual(1e-15);
    expect(pt(1e-300, 2e-10, { ncp: -1.8387038943733192 })).toBe(pnorm(1.8387038943733192));
    // where Φ(-δ) is tiny, the rest of the mass (of order a log(t²/a)) shows
    expect(relativeError(pt(0.001, 2e-6, { ncp: 40, logP: true }) as number, -552.8786680251706)).toBeLessThanOrEqual(1e-14);
    expect(relativeError(dt(-1e-150, 1e-300, { ncp: -3, log: true }) as number, -348.0014302172128)).toBeLessThanOrEqual(1e-14);
    const ld = dt(7.46357687432739e-94, 2.830371717661936e-187, { ncp: 38.166735104830046, log: true }) as number;
    expect(relativeError(ld, -460.70681769328757)).toBeLessThanOrEqual(1e-13);
    // the lower tail stays near Φ(-δ) = 1e-523 (plus a part of order 1e-92) up to the largest double: the quantile is
    // beyond it
    expect(qt(1.4426402575659767e-62, 5.449761356942939e-96, { ncp: 48.87598483697083 })).toBe(Infinity);
  });
});
