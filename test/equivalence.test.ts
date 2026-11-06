import { describe, expect, it } from "vitest";
import { binomDiffCI, binomDiffEquivalenceTest, pnorm, tost, tTest } from "../src/index.js";
import { restrictedMleDiff } from "../src/htest/core/twoProportions.js";
import { arg, defined, loadHTestFixture } from "./helpers/htest.js";
import { num, relativeError } from "./helpers/fixture.js";

/** The 0/1 vectors of the fixture's counts (as oracle/equivalence.R builds them) */
function ones(x: number, n: number): number[] {
  return [...Array<number>(x).fill(1), ...Array<number>(n - x).fill(0)];
}

describe("tost against equivalence::tost", () => {
  const fixture = loadHTestFixture("tost");
  it(`matches R (${fixture.r_version})`, () => {
    let compared = 0;
    let errors = 0;
    for (const c of fixture.cases) {
      const a = c.args;
      const ctx = JSON.stringify(a);
      const run = () =>
        tost(ones(arg.num(a.x1)!, arg.num(a.n1)!), ones(arg.num(a.x2)!, arg.num(a.n2)!), defined({
          epsilon: arg.num(a.epsilon),
          confLevel: arg.num(a.confLevel),
          alpha: arg.num(a.alpha),
          varEqual: a.varEqual === undefined ? undefined : a.varEqual === true,
          paired: a.paired === undefined ? undefined : a.paired === true,
        }));
      const e = c.expected;
      if (e.error !== undefined) {
        // the messages are R's
        expect(run, ctx).toThrow(e.error as string);
        errors++;
        continue;
      }
      const r = run();
      expect(r.method, ctx).toBe(e.method);
      expect(r.result, ctx).toBe(e.result);
      expect(r.warnings, ctx).toEqual(e.warnings);
      expect([r.estimateNames].flat(), ctx).toEqual(e.estimateNames);
      const estimate = [r.estimate].flat();
      expect(estimate.length, ctx).toBe((e.estimate as string[]).length);
      const pairs: [number, string][] = [
        [r.parameter, e.parameter as string],
        [r.pValue, e.tostPValue as string],
        [r.confInt[0], (e.tostInterval as string[])[0]!],
        [r.confInt[1], (e.tostInterval as string[])[1]!],
        [r.confLevel, e.confLevel as string],
        ...estimate.map((v, i): [number, string] => [v, (e.estimate as string[])[i]!]),
        [r.seDiff, e.seDiff as string],
        [r.epsilon, e.epsilon as string],
      ];
      // Closed forms on tTest's pieces (estimates, se and df are R's bits). The t quantile and tail differ from R's in
      // the last bits (1e-15 relative), and the lower end d - q se cancels: 0.1 - 0.112 is 3.4e-14 off relative
      for (const [v, s] of pairs) expect(relativeError(v, num(s)), `${ctx} ${s}`).toBeLessThanOrEqual(1e-13);
      compared++;
    }
    expect(compared).toBe(48);
    expect(errors).toBe(4);
  });
});

describe("tost", () => {
  const x = [5.1, 4.9, 5.6, 5.8, 6.0, 5.4];
  const y = [5.3, 5.0, 5.5, 5.7, 5.9, 5.2];

  it("is the larger one-sided t test of tTest at -epsilon and +epsilon", () => {
    for (const opts of [{}, { varEqual: true }, { paired: true }]) {
      for (const epsilon of [0.05, 0.3, 0.5, 2]) {
        const r = tost(x, y, { epsilon, ...opts });
        const lo = tTest(x, y, { mu: -epsilon, alternative: "greater", ...opts });
        const hi = tTest(x, y, { mu: epsilon, alternative: "less", ...opts });
        expect(relativeError(r.pValue, Math.max(lo.pValue, hi.pValue))).toBeLessThanOrEqual(1e-13);
        // the interval is the two-sided 90% interval of tTest
        const t90 = tTest(x, y, { confLevel: 0.9, ...opts });
        expect(r.confInt[0]).toBeCloseTo(t90.confInt[0], 14);
        expect(r.confInt[1]).toBeCloseTo(t90.confInt[1], 14);
        expect(r.parameter).toBe(t90.parameter);
        expect(r.seDiff).toBe(t90.stdErr);
        expect(r.estimate).toEqual(t90.estimate);
        // dual: rejected exactly when p < alpha (no ties here)
        expect(r.result === "rejected").toBe(r.pValue < 0.05);
      }
    }
    expect(tost(x, y, { paired: true }).method).toBe("Paired TOST");
    expect(tost(x, y, { paired: true }).estimateNames).toBe("mean of the differences");
    expect(tost(x, y, { varEqual: true }).method).toBe(" Two Sample TOST");
  });

  it("gives the documented example", () => {
    const r = tost(x, y, { epsilon: 0.5 });
    expect(r.pValue).toBe(0.029694342816029128);
    expect(r.confInt).toEqual([-0.36394177233776226, 0.4306084390044287]);
    expect(r.result).toBe("rejected");
  });

  it("lets alpha override confLevel, as R", () => {
    const r = tost(x, y, { epsilon: 0.5, confLevel: 0.99, alpha: 0.1 });
    expect(r.confLevel).toBe(0.9);
    expect(r.confInt).toEqual(tost(x, y, { epsilon: 0.5, confLevel: 0.9 }).confInt);
  });

  it("takes the t quantile from the upper tail for alpha below 1e-8 (rule 10; audit 11)", () => {
    // mpmath (60 digits): the upper 1e-12 quantile of t at the Welch df 7.999999999999996 is 69.695043237859712896
    // (from 1 - alpha it was 69.69523624766852, 2.8e-6 relative off)
    const u = [5.1, 4.9, 5.3, 5.0, 4.8, 5.2];
    const v = [5.0, 5.1, 4.9, 5.2, 5.05, 4.95];
    const r = tost(u, v, { epsilon: 0.3, alpha: 1e-12 });
    expect(r.parameter).toBe(7.999999999999996);
    expect(relativeError((r.confInt[1] - r.confInt[0]) / (2 * r.seDiff), 69.695043237859712896)).toBeLessThan(1e-14);
  });

  it("rejects input without a defined result (choice 16)", () => {
    for (const epsilon of [0, -1, NaN, Infinity]) expect(() => tost(x, y, { epsilon })).toThrow(RangeError);
    for (const confLevel of [0, 0.5, 0.3, 1, 1.5, NaN]) expect(() => tost(x, y, { confLevel })).toThrow(RangeError);
    for (const alpha of [0, 0.5, 0.7, -0.1, NaN]) expect(() => tost(x, y, { alpha })).toThrow(RangeError);
    expect(() => tost(x, y, { eps: 1 } as never)).toThrow(RangeError);
    expect(() => tost(x, undefined as never)).toThrow(TypeError);
  });
});

// ---- binomDiffEquivalenceTest ----

/**
 * The restricted MLE p1~ under p1 - p2 = delta, found here independently of the closed form: bisection of the score
 * equation x1/p - (n1 - x1)/(1 - p) + x2/(p - delta) - (n2 - x2)/(1 - p + delta) = 0, which decreases in p over
 * (max(0, delta), min(1, 1 + delta)); where it keeps one sign, the MLE is the end it pushes towards
 */
function mleBisection(x1: number, n1: number, x2: number, n2: number, delta: number): number {
  const score = (p: number): number => {
    let s = 0;
    if (x1 > 0) s += x1 / p;
    if (n1 - x1 > 0) s -= (n1 - x1) / (1 - p);
    if (x2 > 0) s += x2 / (p - delta);
    if (n2 - x2 > 0) s -= (n2 - x2) / (1 - p + delta);
    return s;
  };
  let lo = Math.max(0, delta);
  let hi = Math.min(1, 1 + delta);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    const s = score(mid);
    if (s > 0) lo = mid;
    else if (s < 0) hi = mid;
    else return mid;
  }
  return (lo + hi) / 2;
}

/** The statistic of the specification (section 6) at delta0, from the independent MLE */
function zSpec(x1: number, n1: number, x2: number, n2: number, delta0: number, method: "mn" | "mee" | "wald"): number {
  const d = x1 / n1 - x2 / n2;
  if (method === "wald") {
    const p1 = x1 / n1;
    const p2 = x2 / n2;
    return (d - delta0) / Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  }
  const q1 = mleBisection(x1, n1, x2, n2, delta0);
  const q2 = q1 - delta0;
  let v = (q1 * (1 - q1)) / n1 + (q2 * (1 - q2)) / n2;
  if (method === "mn") v *= (n1 + n2) / (n1 + n2 - 1);
  return (d - delta0) / Math.sqrt(v);
}

const METHODS = ["mn", "mee", "wald"] as const;

/** Every table with the given group sizes */
function* tables(sizes: [number, number][]): Generator<[number, number, number, number]> {
  for (const [n1, n2] of sizes) for (let x1 = 0; x1 <= n1; x1++) for (let x2 = 0; x2 <= n2; x2++) yield [x1, n1, x2, n2];
}

describe("binomDiffEquivalenceTest", () => {
  it("has the statistics of the specification at -margin and +margin", () => {
    let worst = 0;
    for (const [x1, n1, x2, n2] of tables([[10, 10], [7, 12], [30, 25], [100, 80]])) {
      for (const margin of [0.05, 0.2, 0.45]) {
        for (const method of METHODS) {
          const r = binomDiffEquivalenceTest(x1, n1, x2, n2, { margin, method });
          const z = [zSpec(x1, n1, x2, n2, -margin, method), zSpec(x1, n1, x2, n2, margin, method)];
          for (let k = 0; k < 2; k++) {
            if (!Number.isFinite(z[k]!)) {
              // the Wald variance 0 (both proportions 0 or 1)
              expect(r.statistic[k]).toBe(z[k]);
              continue;
            }
            // absolute where z is near 0 (the deviation d - delta0 cancels: a few ulps of 1 over the standard error)
            worst = Math.max(worst, Math.abs(r.statistic[k]! - z[k]!) / Math.max(Math.abs(z[k]!), 1));
          }
          expect(r.pValues[0]).toBe(pnorm(r.statistic[0], { lowerTail: false }));
          expect(r.pValues[1]).toBe(pnorm(r.statistic[1]));
          expect(r.pValue).toBe(Math.max(...r.pValues));
          expect(r.estimate).toBe(x1 / n1 - x2 / n2);
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(1e-12);
  });

  it("is dual to binomDiffCI at 1 - 2 alpha", () => {
    let checked = 0;
    let boundary = 0;
    for (const [x1, n1, x2, n2] of tables([[5, 5], [10, 10], [8, 15], [40, 30], [61, 47]])) {
      for (const method of METHODS) {
        for (const alpha of [0.025, 0.05, 0.1, 0.2]) {
          const ci = binomDiffCI(x1, n1, x2, n2, { method, confLevel: 1 - 2 * alpha }).confInt;
          for (const margin of [0.01, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 0.99]) {
            // away from ties, the test rejects exactly when the interval lies inside (-margin, margin)
            if (Math.abs(ci[0] + margin) < 1e-12 || Math.abs(ci[1] - margin) < 1e-12) continue;
            const r = binomDiffEquivalenceTest(x1, n1, x2, n2, { margin, method, alpha });
            expect(r.confInt).toEqual(ci);
            expect(r.confLevel).toBe(1 - 2 * alpha);
            expect(r.result === "rejected", `${x1}/${n1} ${x2}/${n2} ${method} ${alpha} ${margin}`).toBe(ci[0] > -margin && ci[1] < margin);
            checked++;
          }
          // On the boundary: with the margin at a limit, that side's p-value is alpha (the limit is the root of
          // z^2 = qchisq(1 - 2 alpha, 1)); just inside and outside of it the decision of that side flips
          for (const [k, margin] of [[0, -ci[0]], [1, ci[1]]] as const) {
            if (!(margin > 1e-6 && margin < 1 - 1e-6)) continue;
            // (Wald's interval is clipped at -1 and 1 and is a point where its variance is 0)
            if (method === "wald" && (ci[0] === ci[1] || ci[0] === -1 || ci[1] === 1)) continue;
            const r = binomDiffEquivalenceTest(x1, n1, x2, n2, { margin, method, alpha });
            // the limit is a root to the precision of the doubles; p moves by phi(z) dz/ddelta = O(1/se) per unit
            const ctx = `${x1}/${n1} ${x2}/${n2} ${method} ${alpha} ${k}`;
            expect(relativeError(r.pValues[k], alpha), ctx).toBeLessThanOrEqual(1e-9);
            const step = 1e-6;
            expect(binomDiffEquivalenceTest(x1, n1, x2, n2, { margin: margin + step, method, alpha }).pValues[k], ctx).toBeLessThan(alpha);
            expect(binomDiffEquivalenceTest(x1, n1, x2, n2, { margin: margin - step, method, alpha }).pValues[k], ctx).toBeGreaterThan(alpha);
            boundary++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100000);
    expect(boundary).toBeGreaterThan(10000);
  });

  it("agrees with published numbers", () => {
    // Newcombe (Statistics in Medicine 17, 1998, Table II, example (a)): 56/70 - 48/80, the Miettinen-Nurminen 95%
    // interval 0.0528 to 0.3382 (4 decimals). By duality the upper one-sided p-value at alpha = 0.025 crosses 0.025
    // between margins on either side of the printed upper limit
    const at = (margin: number) => binomDiffEquivalenceTest(56, 70, 48, 80, { margin, alpha: 0.025 }).pValues[1];
    expect(at(0.33825)).toBeLessThan(0.025);
    expect(at(0.33815)).toBeGreaterThan(0.025);
    // the lower limit 0.0528: the statistic at delta0 = +0.0528 is minus that of the reversed groups at -0.0528, so
    // their p-value P(Z > z(-margin)) crosses 1 - 0.025 there
    const rev = (margin: number) => binomDiffEquivalenceTest(48, 80, 56, 70, { margin, alpha: 0.025 }).pValues[0];
    expect(rev(0.05285)).toBeLessThan(0.975);
    expect(rev(0.05275)).toBeGreaterThan(0.975);
    // Anderson (Farrington-Manning in the extreme case, arXiv:2205.03460, 2022, eq. 13): p1 = 1/3, p2 = 1/2, ratio
    // n2/n1 = 2/3 and s0 = 1/2 give Farrington and Manning's cubic 20x^3 - 44x^2 + 25x - 3 = 0 for x = p1~
    const [q1] = restrictedMleDiff(2, 6, 2, 4, 0.5);
    expect(q1).toBeGreaterThanOrEqual(0.5);
    expect(Math.abs(((20 * q1 - 44) * q1 + 25) * q1 - 3)).toBeLessThanOrEqual(1e-14);
  });

  it("gives the documented example", () => {
    const r = binomDiffEquivalenceTest(80, 100, 78, 100, { margin: 0.15 });
    // (mpmath, 250 digits: 0.0018937433499954866863 and 0.01289972536167584567; worked from the failures since
    // p1 + p2 > 1, the values were 0.0018937433499954838 and 0.012899725361675855 before)
    expect(r.pValues).toEqual([0.0018937433499954864, 0.012899725361675841]);
    expect(r.pValue).toBe(0.012899725361675841);
    // (the true -0.0755769753360857571 and 0.115536386476865677: each 1 ulp from them rounded, as the score equation
    // is now solved in the failures (p1 + p2 > 1). The statistic changes by about 1.3 eps per ulp of delta here, and
    // the restricted MLE in doubles holds about 1 eps, so the last ulp is not determined; the limits of 1.2.0 before
    // the change, [-0.07557697533608576, 0.11553638647686568], were the true values rounded by chance)
    expect(r.confInt).toEqual([-0.07557697533608577, 0.11553638647686569]);
    expect(r.result).toBe("rejected");
    expect(r.method).toBe("mn");
  });

  it("keeps the digits of small proportions (audit 1)", () => {
    // mpmath (250 digits, the restricted MLE by bisection): z = 3.3098215520290958791 and -1.9744429701426078397,
    // p = 4.6677733972783324032e-4 and 0.024165698053707604462 (the closed form of the MLE gave 3.00828, p 1.31e-3)
    const r = binomDiffEquivalenceTest(5, 1e9, 2, 1e9, { margin: 1e-8 });
    expect(relativeError(r.statistic[0], 3.3098215520290958791)).toBeLessThan(1e-14);
    expect(relativeError(r.statistic[1], -1.9744429701426078397)).toBeLessThan(1e-14);
    expect(relativeError(r.pValues[0], 4.6677733972783324032e-4)).toBeLessThan(1e-14);
    expect(relativeError(r.pValues[1], 0.024165698053707604462)).toBeLessThan(1e-14);
  });

  it("builds the interval from 2 alpha itself (audit 11)", () => {
    // mpmath (250 digits): the mn limits of 56/70 against 48/80 with the bound qchisq(2e-10, 1, upper)
    const r = binomDiffEquivalenceTest(56, 70, 48, 80, { margin: 0.5, alpha: 1e-10 });
    expect(relativeError(r.confInt[0], -0.28235643448811864526)).toBeLessThan(4 * 2 ** -52);
    expect(relativeError(r.confInt[1], 0.59510846464680767964)).toBeLessThan(4 * 2 ** -52);
  });

  it("is infinite for Wald where both proportions are 0 or 1", () => {
    const r = binomDiffEquivalenceTest(0, 10, 0, 12, { margin: 0.1, method: "wald" });
    expect(r.statistic).toEqual([Infinity, -Infinity]);
    expect(r.pValues).toEqual([0, 0]);
    expect(r.confInt).toEqual([0, 0]);
    // the score statistics stay finite there
    const s = binomDiffEquivalenceTest(0, 10, 0, 12, { margin: 0.1 });
    expect(s.statistic.every(Number.isFinite)).toBe(true);
  });

  it("rejects input without a defined result (choice 16)", () => {
    const f = (o: object, c: [number, number, number, number] = [5, 10, 4, 10]) => () => binomDiffEquivalenceTest(...c, o as never);
    expect(f({})).toThrow(TypeError);
    for (const margin of [0, 1, -0.1, 1.5, NaN]) expect(f({ margin })).toThrow(RangeError);
    for (const alpha of [0, 0.5, 0.7, -0.1, NaN]) expect(f({ margin: 0.1, alpha })).toThrow(RangeError);
    expect(f({ margin: 0.1, method: "score" })).toThrow(RangeError);
    expect(f({ margin: 0.1, method: "m" })).toThrow(RangeError);
    expect(f({ margin: 0.1, method: "w" })().method).toBe("wald");
    expect(f({ margin: 0.1, epsilon: 0.1 })).toThrow(RangeError);
    for (const c of [[11, 10, 4, 10], [-1, 10, 4, 10], [2.5, 10, 4, 10], [0, 0, 4, 10]] as [number, number, number, number][]) {
      expect(f({ margin: 0.1 }, c)).toThrow(RangeError);
    }
  });
});
