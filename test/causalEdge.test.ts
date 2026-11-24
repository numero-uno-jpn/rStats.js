// Edge cases and extreme scales of match, balTab, tableOneSmd and clogit (experiments/psm112-edge.R, x86_64 R 4.6.2).
// Where R is right its values are compared; where R breaks down (Match fails for |x| near 1e300 and ties everything
// near 1e-300; bal.tab and tableone overflow or underflow) the results must not depend on the scale or on a common
// offset, which standardised differences and variance ratios do not.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { balTab, match, tableOneSmd } from "../src/entries/causal.js";
import { clogit } from "../src/entries/tests.js";
import { setSeed } from "../src/entries/distributions.js";

const edge = JSON.parse(readFileSync(new URL("../experiments/psm112-edge.json", import.meta.url), "utf8")) as Record<string, any>;
const rel = (a: number, e: number): number => (e === 0 ? Math.abs(a) : Math.abs(a - e) / Math.abs(e));
const tr = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
const x = edge.match.base.X as number[];

describe("match at extreme scales", () => {
  it("gives the same pairs at every scale and the caliper in the units of x", () => {
    setSeed(1);
    const base = match(tr, x, { caliper: 0.5 });
    expect(base.indexControl).toEqual(edge.match.base.cal.value.c);
    expect(rel(base.ecaliper!, edge.match.base.cal.value.ecaliper)).toBeLessThan(1e-15);
    for (const k of [1e300, 1e-300, 1e-310]) {
      setSeed(1);
      const m = match(tr, x.map((v) => v * k), { caliper: 0.5 });
      expect(m.indexControl).toEqual(base.indexControl);
      expect(m.tieSizes).toEqual([]);
      expect(rel(m.ecaliper! / k, base.ecaliper!)).toBeLessThan(k < 1e-300 ? 1e-6 : 1e-14);
    }
  });
  it("keeps R's pairs with a large common offset and when all x are equal", () => {
    setSeed(1);
    expect(match(tr, edge.match.offset.X).indexControl).toEqual(edge.match.offset.nocal.value.c);
    setSeed(1);
    const m = match([1, 0, 1, 0], [2, 2, 2, 2], { caliper: 0.2 });
    expect(m.indexControl).toEqual(edge.match.allEqualX.value.c);
    expect(m.ecaliper).toBe(0);
    expect(() => match([1, 0, 1, 0], [1, Infinity, 2, 3])).toThrow(/NAs/);
  });
});

describe("balTab and tableOneSmd at extreme scales", () => {
  setSeed(1);
  const m = match(tr, x);
  const age = [52, 40, 61, 58, 33, 47, 50, 45, 39, 55];
  const stats = (v: number[]) => { const b = balTab(tr, { v }, { match: m }); return [b.diffUn[0]!, b.diffAdj[0]!, b.vRatioUn[0]!, b.vRatioAdj[0]!]; };
  it("matches R at the ordinary scale and does not depend on the scale or an offset", () => {
    const base = stats(age);
    const r = edge.baltab.base.value;
    [r.diffUn, r.diffAdj, r.vUn, r.vAdj].forEach((e: number, i: number) => expect(rel(base[i]!, e)).toBeLessThan(1e-13));
    for (const v of [age.map((a) => a * 1e300), age.map((a) => a * 1e-300), age.map((a) => a + 1e15), age.map((a) => a * 1e200)]) {
      stats(v).forEach((s, i) => expect(rel(s, base[i]!)).toBeLessThan(1e-13));
    }
    const c = stats(age.map(() => 3));
    expect(c.slice(0, 2)).toEqual([0, 0]);
    expect(c.slice(2).every(Number.isNaN)).toBe(true);
  });
  it("tableOneSmd: R's values, the generalised inverse, NaN where R gives NA or NaN", () => {
    const g = [0, 0, 0, 0, 1, 1, 1, 1], v = [1, 2, 4, 3, 5, 4, 6, 7];
    const base = tableOneSmd(v, g);
    expect(rel(base, edge.tableone.offset.value)).toBeLessThan(1e-13);
    for (const w of [v.map((a) => a * 1e300), v.map((a) => a * 1e-300), v.map((a) => a + 1e15)]) expect(rel(tableOneSmd(w, g), base)).toBeLessThan(1e-13);
    expect(tableOneSmd([1, 2], [0, 1])).toBeNaN();
    expect(rel(tableOneSmd(["a", "a", "b", "a", "c", "c", "c", "c"], g, { factor: true }), edge.tableone.factorAbsent.value)).toBeLessThan(1e-13);
    expect(tableOneSmd(["a", "a", "a", "a", "b", "b", "b", "b"], g, { factor: true })).toBeNaN();
  });
});

describe("clogit at the edges", () => {
  const s = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6], y = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  const z = [0.3, 0.1, 0.5, 0.9, 0.2, 0.4, 0.8, 0.6, 0.1, 0.7, 0.4, 0.2];
  for (const method of ["exact", "approximate"] as const) {
    const r = edge.clogit[method];
    it(`${method}: separation, collinearity and scales as R`, () => {
      const sep = clogit(y, y.map((v) => [v]), s, { method });
      expect(rel(sep.coefficients[0]!, r.separation.value.coef)).toBeLessThan(1e-8);
      expect(sep.iter).toBe(r.separation.value.iter);
      expect(sep.warnings).toEqual([r.separation.warnings]);
      const col = clogit(y, z.map((v) => [v, 2 * v]), s, { method });
      expect(rel(col.coefficients[0]!, r.collinear.value.coef[0])).toBeLessThan(1e-12);
      expect(col.coefficients[1]).toBeNaN();
      for (const [key, k] of [["bigScale", 1e150], ["tinyScale", 1e-150]] as const) {
        const f = clogit(y, z.map((v) => [v * k]), s, { method });
        expect(rel(f.coefficients[0]!, r[key].value.coef)).toBeLessThan(1e-12);
        expect(rel(f.var[0]![0]!, r[key].value.var)).toBeLessThan(1e-12);
      }
      const off = clogit(y, z.map((v) => [v + 1e12]), s, { method });
      expect(rel(off.coefficients[0]!, r.offset.value.coef)).toBeLessThan(1e-9);
    });
  }
  it("exact: a large matched set (300 with 150 cases as R; 2000 with 1000 without overflow)", () => {
    const L = edge.clogit.largeSetData;
    const f = clogit(L.y, L.z.map((v: number) => [v]), L.y.map(() => 1));
    expect(rel(f.coefficients[0]!, edge.clogit.largeSet.value.coef)).toBeLessThan(1e-12);
    expect(rel(f.loglik[1], edge.clogit.largeSet.value.loglik[1])).toBeLessThan(1e-13);
    const n = 2000, yy = Array.from({ length: n }, (_, i) => (i < 1000 ? 1 : 0));
    const big = clogit(yy, yy.map((v, i) => [Math.sin(i) + 0.3 * v]), yy.map(() => 1));
    expect(Number.isFinite(big.coefficients[0]!) && Number.isFinite(big.loglik[1])).toBe(true);
  });
  it("exact: only uninformative sets run out of iterations (R: coefficient 0 with a meaningless variance; here NaN)", () => {
    const f = clogit([1, 1, 0, 0], [[1], [2], [3], [4]], [1, 1, 2, 2]);
    expect(f.iter).toBe(edge.clogit.exact.uninformative.value.iter);
    expect(f.warnings).toEqual([edge.clogit.exact.uninformative.warnings]);
    expect(f.coefficients[0]).toBeNaN();
  });
});
