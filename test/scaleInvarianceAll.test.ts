// Every statistic built on the shared moments (src/internal/summary.ts) at any scale of the data: the external
// re-audit of 2026-10-31 (rstats_audit_recheck.md, R01-R12). New functions on means, variances or sums of squares
// belong in this table.
import { describe, expect, it } from "vitest";
import {
  TukeyHSD,
  adTest,
  anova,
  aov,
  aovEz,
  bartlettTest,
  chisqTest,
  cohensD,
  cor,
  cov,
  cronbachAlpha,
  cvmTest,
  gamesHowellTest,
  glhtDunnett,
  hedgesG,
  icc,
  leveneTest,
  lillieTest,
  lm,
  mauchlyTest,
  onewayTest,
  pairwiseTTest,
  pearsonTest,
  sfTest,
  tTest,
  tukeyTest,
  varTest,
  zTest,
} from "../src/index.js";
import { productOver } from "../src/internal/summary.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const a = [1, 2, 3, 4, 5.5];
const b = [2, 4, 5, 6.5, 8, 9];
const g = [...a.map(() => "a"), ...b.map(() => "b")];
const three = [[1, 2, 3.5], [4, 5, 6.25], [7, 8.5, 9]];
const g3 = three.flatMap((s, i) => s.map(() => `g${i}`));
const twelve = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.9, 3.7, 6.1, 2.2, 4.0];
const ratings = [[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]];
const rm = [[10.5, 9.8, 8.8], [11.2, 10.1, 9.9], [9.7, 9.5, 9.0], [10.9, 10.6, 9.1], [10.1, 9.2, 9.4], [9.8, 9.4, 8.7], [10.8, 10.0, 9.3], [10.2, 9.6, 9.1]];
const times = (v: readonly number[], c: number): number[] => v.map((x) => x * c);

describe("scale invariance", () => {
  it("tTest (Welch, pooled, one sample, paired)", () => {
    expectScaleInvariant("welch", (c) => tTest(times(a, c), times(b, c)), {
      unitless: (r) => [r.statistic, r.parameter, r.pValue],
      units: (r) => [...r.confInt, r.stdErr],
    });
    expectScaleInvariant("pooled", (c) => tTest(times(a, c), times(b, c), { varEqual: true }), { unitless: (r) => [r.statistic, r.pValue] });
    expectScaleInvariant("one", (c) => tTest(times(a, c), { mu: 2 * c }), { unitless: (r) => [r.statistic, r.pValue], units: (r) => r.confInt });
    expectScaleInvariant("paired", (c) => tTest(times(a, c), times(b.slice(0, 5), c), { paired: true }), {
      unitless: (r) => [r.statistic, r.pValue],
      units: (r) => [...r.confInt, r.stdErr],
    });
  });
  it("zTest", () => {
    expectScaleInvariant("z", (c) => zTest(times(a, c), times(b, c), { sigmaX: 2 * c, sigmaY: 3 * c }), {
      unitless: (r) => [r.statistic, r.pValue],
      units: (r) => r.confInt!,
    });
  });
  it("cohensD and hedgesG", () => {
    expectScaleInvariant("d", (c) => cohensD(times(a, c), times(b, c)), { unitless: (r) => [r.value, r.ciLow!, r.ciHigh!] });
    expectScaleInvariant("d unpooled", (c) => cohensD(times(a, c), times(b, c), { pooledSd: false }), { unitless: (r) => [r.value] });
    expectScaleInvariant("d paired", (c) => cohensD(times(a, c), times(b.slice(0, 5), c), { paired: true }), { unitless: (r) => [r.value] });
    expectScaleInvariant("g", (c) => hedgesG(times(a, c), times(b, c)), { unitless: (r) => [r.value, r.ciLow!, r.ciHigh!] });
  });
  it("icc and cronbachAlpha", () => {
    const scaled = (c: number): number[][] => ratings.map((r) => times(r, c));
    expectScaleInvariant("icc", (c) => icc(scaled(c), { model: "twoway", type: "agreement" }), {
      unitless: (r) => [r.value, r.Fvalue, r.pValue, r.lbound, r.ubound],
    });
    expectScaleInvariant("alpha", (c) => cronbachAlpha(scaled(c)), { unitless: (r) => [r.rawAlpha, r.stdAlpha, ...r.alphaDrop] });
  });
  it("normality tests", () => {
    for (const [name, f] of [["ad", adTest], ["cvm", cvmTest], ["lillie", lillieTest], ["sf", sfTest], ["pearson", pearsonTest]] as const) {
      expectScaleInvariant(name, (c) => f(times(twelve, c)), { unitless: (r) => [r.statistic, r.pValue] });
    }
  });
  it("one-way analyses of means and variances", () => {
    const sc = (c: number): number[][] => three.map((s) => times(s, c));
    expectScaleInvariant("aov", (c) => aov(sc(c)), { unitless: (r) => [r.fValue, r.pValue], squared: (r) => r.sumSq });
    expectScaleInvariant("TukeyHSD", (c) => TukeyHSD(sc(c)), { unitless: (r) => r.pAdj, units: (r) => [...r.diff, ...r.lwr, ...r.upr] });
    expectScaleInvariant("levene", (c) => leveneTest(sc(c).flat(), g3), { unitless: (r) => r.table[0]!.slice(1) });
    expectScaleInvariant("oneway", (c) => onewayTest(sc(c)), { unitless: (r) => [r.statistic, r.pValue] });
    expectScaleInvariant("var", (c) => varTest(times(a, c), times(b, c)), { unitless: (r) => [r.statistic, r.pValue] });
    expectScaleInvariant("bartlett", (c) => bartlettTest(sc(c)), { unitless: (r) => [r.statistic, r.pValue] });
    expectScaleInvariant("games-howell", (c) => gamesHowellTest(sc(c).flat(), g3), { unitless: (r) => r.pValue.flat().filter((v) => !Number.isNaN(v)) });
    expectScaleInvariant("tukey", (c) => tukeyTest(sc(c).flat(), g3), { unitless: (r) => r.pValue.flat().filter((v) => !Number.isNaN(v)) });
    expectScaleInvariant("dunnett", (c) => glhtDunnett(sc(c).flat(), g3), { unitless: (r) => [...r.t, ...r.p], units: (r) => [...r.estimate, ...r.se] });
    expectScaleInvariant("pairwise", (c) => pairwiseTTest(sc(c).flat(), g3), { unitless: (r) => r.pValue.flat().filter((v) => !Number.isNaN(v)) });
  });
  it("lm and anova", () => {
    const data = (c: number) => ({ y: times([4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.6, 9.1], c), x: [1, 2, 3, 4, 5, 6, 7, 8], g: ["a", "b", "a", "b", "a", "b", "a", "b"] });
    expectScaleInvariant("lm", (c) => lm("y ~ x + g", data(c)), {
      unitless: (r) => [...r.coefTable.tValue, ...r.coefTable.pValue, r.rSquared, r.fStatistic!.value],
      units: (r) => [...r.coefficients, r.sigma, ...r.coefTable.stdError],
    });
    expectScaleInvariant("anova", (c) => anova(lm("y ~ x + g", data(c))), { unitless: (r) => r.table.slice(0, 2).flatMap((row) => [row[3]!, row[4]!]) });
    expectScaleInvariant("anova 2", (c) => anova(lm("y ~ x", data(c)), lm("y ~ x + g", data(c))), { unitless: (r) => [r.table[1]![4]!, r.table[1]![5]!] });
  });
  it("aov with Error() strata", () => {
    const data = (c: number) => {
      const d = { id: [] as string[], w: [] as string[], y: [] as number[] };
      rm.forEach((r, i) => r.forEach((v, j) => (d.id.push(`s${i}`), d.w.push(`c${j}`), d.y.push(v * c))));
      return d;
    };
    expectScaleInvariant("strata", (c) => aov("y ~ w + Error(id/w)", data(c)), {
      unitless: (r) => ("strata" in r ? r.strata.flatMap((s) => s.table.flatMap((row) => row.slice(3).filter((v) => !Number.isNaN(v)))) : []),
    });
  });
  it("aovEz effect sizes and mauchlyTest", () => {
    const data = (c: number) => {
      const d = { id: [] as string[], w: [] as string[], dv: [] as number[] };
      rm.forEach((r, i) => r.forEach((v, j) => (d.id.push(`s${i}`), d.w.push(`c${j}`), d.dv.push(v * c))));
      return d;
    };
    expectScaleInvariant("aovEz", (c) => aovEz(data(c), { id: "id", dv: "dv", within: "w", es: ["ges", "pes"] }), {
      unitless: (r) => [r.anova.table[0]![3]!, r.anova.table[0]![4]!, r.anova.table[0]![5]!, r.anova.table[0]![6]!],
      squared: (r) => [r.anova.table[0]![2]!],
    });
    expectScaleInvariant("mauchly", (c) => mauchlyTest(rm.map((r) => times(r, c)), { X: "~1" }), { unitless: (r) => [r.statistic, r.pValue] });
  });
});

describe("the foundation itself", () => {
  it("centres after scaling: cov and cor of values near both ends of the range", () => {
    const x = [Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE];
    const y = [-1e-308, -1e-308, 1e-308];
    const want = -(4 / 3) * (Number.MAX_VALUE * 1e-308);
    expect(Math.abs((cov(x, y) as number) - want)).toBeLessThan(1e-12 * Math.abs(want));
    expect(cor(x, y)).toBe(-1);
  });
  it("takes paired differences after scaling", () => {
    const x = [1.7e308, -1.7e308, 1.6e308, -1.7e308];
    const y = [-1.7e308, 1.7e308, -1.7e308, 1.6e308];
    const r = tTest(x, y, { paired: true });
    const s = tTest(times(x, 2 ** -1000), times(y, 2 ** -1000), { paired: true });
    expect(r.statistic).toBe(s.statistic);
    expect(r.pValue).toBe(s.pValue);
  });
  it("centres the t interval on the estimate", () => {
    const r = tTest([1, 2, 3, 4], { mu: 1e100 }).confInt;
    expect(r[0]).toBeCloseTo(0.4457397432391206, 12);
    expect(r[1]).toBeCloseTo(4.554260256760879, 12);
  });
  it("productOver: an underflowing product is not 0", () => {
    expect(productOver(1e-200, 1e-200, 1e-200)).toBe(1e-200);
    const t = chisqTest([[1e-200, 1e-200], [1e-200, 1e-200]], { correct: false });
    expect(t.expected).toEqual([[1e-200, 1e-200], [1e-200, 1e-200]]);
    expect(t.statistic).toBe(0);
    expect(t.pValue).toBe(1);
  });
  it("no residual degrees of freedom is an error", () => {
    const d = { id: ["1", "1", "2", "2"], b: ["x", "x", "y", "y"], w: ["p", "q", "p", "q"], dv: [1, 2, 3, 5] };
    expect(() => aovEz(d, { id: "id", dv: "dv", between: "b", within: "w" })).toThrow(/no residual degrees of freedom/);
    expect(() => mauchlyTest([[1, 2, 3], [2, 3, 5]], { X: "~1", group: ["a", "b"] })).toThrow(/no residual degrees of freedom/);
  });
});
