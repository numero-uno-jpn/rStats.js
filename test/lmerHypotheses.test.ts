// The hypothesis matrices of lmerTest's Type I, II and III ANOVA tables (oracle/lmertest-behaviour.md, section 2)
// against the fixture lmerTest (oracle/lmertest.R, `expected.anova[].hypotheses`): the terms, the names of the rows
// and columns, and the values, exactly where lmerTest rounds them last (Type III without the mapping to another
// coding: R's zapsmall) and within 1e-13 (relative to max(1, |value|)) otherwise; the "Missing cells" message of Type
// III equal to lmerTest's. Also R's round(x, digits) and zapsmall (src/internal/fround.ts) against R's documented
// behaviour.
import { describe, expect, it } from "vitest";
import { roundR, zapsmall } from "../src/internal/fround.js";
import { containingTerms, doolittle, fixedEffectsDescription, lmerHypotheses, type HypothesisType } from "../src/models/lmerHypotheses.js";
import type { DesignContrast } from "../src/models/modelMatrix.js";
import { num } from "./helpers/fixture.js";
import { dataFrameOf, loadAnovaFixture } from "./helpers/anova.js";

interface FixtureHypothesis {
  term: string;
  rows: string[];
  columns: string[];
  values: string[][];
}
interface FixtureAnova {
  type: HypothesisType;
  hypotheses: FixtureHypothesis[];
}

const TOL = 1e-13;
const MISSING_CELLS = "Missing cells for:";

describe("lmerTest's hypothesis matrices", () => {
  const fixture = loadAnovaFixture("lmerTest");
  it(`match lmerTest for every case and type (${fixture.r_version})`, () => {
    const failures: string[] = [];
    let worst = 0;
    let exactCompared = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const options: { contrasts?: Record<string, DesignContrast>; levels?: Record<string, readonly string[]> } = {};
      if (a.contrasts !== undefined) options.contrasts = a.contrasts as Record<string, DesignContrast>;
      if (a.levels !== undefined) options.levels = a.levels as Record<string, readonly string[]>;
      const desc = fixedEffectsDescription(a.formula as string, dataFrameOf(a.data, a.dataTypes), options);
      const where = `case ${index} (${String(a.formula)}, contrasts ${JSON.stringify(a.contrasts ?? {})})`;
      const treatment = Object.values(desc.contrasts).every((x) => x === "contr.treatment");
      const messages: string[] = [];
      for (const anova of c.expected.anova as FixtureAnova[]) {
        const got = lmerHypotheses(desc, anova.type);
        messages.push(...got.messages);
        const w = `${where} type ${anova.type}`;
        const want = anova.hypotheses;
        const terms = got.hypotheses.map((h) => h.term);
        if (JSON.stringify(terms) !== JSON.stringify(want.map((h) => h.term))) {
          failures.push(`${w}: terms ${JSON.stringify(terms)}, expected ${JSON.stringify(want.map((h) => h.term))}`);
          continue;
        }
        // exact where lmerTest's last step is zapsmall: Type III in treatment coding (several terms, more than one column)
        const exact = anova.type === "III" && treatment && desc.terms.length > 1 && desc.colNames.length > 1;
        want.forEach((h, k) => {
          const g = got.hypotheses[k]!;
          if (JSON.stringify(g.rows) !== JSON.stringify(h.rows)) failures.push(`${w} ${h.term}: rows ${JSON.stringify(g.rows)}, expected ${JSON.stringify(h.rows)}`);
          if (JSON.stringify(g.columns) !== JSON.stringify(h.columns)) failures.push(`${w} ${h.term}: columns ${JSON.stringify(g.columns)}, expected ${JSON.stringify(h.columns)}`);
          if (g.values.length !== h.values.length) return;
          h.values.forEach((row, i) => {
            row.forEach((s, j) => {
              const x = num(s);
              const v = g.values[i]![j]!;
              if (exact) {
                exactCompared++;
                if (v !== x) failures.push(`${w} ${h.term}[${i}][${j}]: expected exactly ${s}, got ${v}`);
                return;
              }
              const err = Math.abs(v - x) / Math.max(1, Math.abs(x));
              worst = Math.max(worst, Number.isNaN(err) ? Infinity : err);
              if (!(err <= TOL)) failures.push(`${w} ${h.term}[${i}][${j}]: expected ${s}, got ${v}`);
            });
          });
        });
      }
      const expectedMessages = (c.expected.messages as string[]).filter((m) => m.startsWith(MISSING_CELLS));
      if (JSON.stringify([...new Set(messages)]) !== JSON.stringify(expectedMessages)) {
        failures.push(`${where} messages ${JSON.stringify(messages)}, expected ${JSON.stringify(expectedMessages)}`);
      }
    });
    console.log(`lmerTest hypotheses: ${fixture.cases.length} cases, ${exactCompared} values compared exactly; largest other error ${worst.toExponential(1)}`);
    expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
  });

  it("drops aliased columns as lmer does", () => {
    const data = { y: [1, 2, 3, 4, 5, 6, 7, 8], x: [1, 2, 3, 4, 5, 6, 7, 8], z: [2, 4, 6, 8, 10, 12, 14, 16], g: ["a", "a", "b", "b", "c", "c", "d", "d"] };
    const desc = fixedEffectsDescription("y ~ x + z + (1 | g)", data);
    expect(desc.colNames).toEqual(["(Intercept)", "x"]);
    expect(desc.assign).toEqual([0, 1]);
  });

  it("containment: same numeric variables, more variables", () => {
    const data = { y: [1, 2, 3, 4, 5, 6], x: [1, 3, 2, 5, 4, 6], f: ["a", "b", "c", "a", "b", "c"], g: ["p", "p", "q", "q", "r", "r"] };
    const desc = fixedEffectsDescription("y ~ x * f + (1 | g)", data);
    expect(desc.terms.map((t) => t.label)).toEqual(["x", "f", "x:f"]);
    expect(containingTerms(desc)).toEqual([[2], [], []]);
  });

  it("Doolittle: S = L U, pivots below 1e-6 give zero columns", () => {
    const s = [
      [4, 2, 2],
      [2, 5, 3],
      [2, 3, 6],
    ];
    const { L, U } = doolittle(s);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let v = 0;
        for (let k = 0; k < 3; k++) v += L[i]![k]! * U[k]![j]!;
        expect(v).toBeCloseTo(s[i]![j]!, 14);
      }
    }
    const singular = doolittle([
      [1, 1, 0],
      [1, 1, 0],
      [0, 0, 2],
    ]);
    expect(singular.L.map((r) => r[1])).toEqual([0, 1, 0]);
  });
});

describe("R's round and zapsmall", () => {
  it("special values", () => {
    expect(roundR(NaN, 2)).toBeNaN();
    expect(roundR(1.5, NaN)).toBeNaN();
    expect(roundR(Infinity, 2)).toBe(Infinity);
    expect(roundR(-Infinity, -2)).toBe(-Infinity);
    expect(roundR(0, 3)).toBe(0);
    expect(roundR(1.23456, 324)).toBe(1.23456);
    expect(roundR(1.23456e300, -309)).toBe(0);
  });

  it("digits = 0 rounds half to even (IEC 60559)", () => {
    expect([0.5, 1.5, 2.5, 3.5, -0.5, -1.5, -2.5, 2.4999999999999996, 0.49999999999999994].map((x) => roundR(x))).toEqual([0, 2, 2, 4, -0, -2, -2, 2, 0]);
    expect(Object.is(roundR(-0.4), -0)).toBe(true);
  });

  it("chooses the candidate closer to x in double arithmetic, a tie to even", () => {
    // 0.15, 0.35 and 2.675 are stored below the decimal value; 0.25 is an exact tie: to even; 0.45 is stored above
    // 0.45, but 0.5 - 0.45 and 0.45 - 0.4 are the same double, a tie: to even; 0.6 - 0.55 < 0.55 - 0.5
    expect(roundR(0.15, 1)).toBe(0.1);
    expect(roundR(0.25, 1)).toBe(0.2);
    expect(roundR(0.35, 1)).toBe(0.3);
    expect(roundR(0.45, 1)).toBe(0.4);
    expect(roundR(0.55, 1)).toBe(0.6);
    expect(roundR(2.675, 2)).toBe(2.67);
    expect(roundR(-2.675, 2)).toBe(-2.67);
    expect(roundR(0.125, 2)).toBe(0.12);
    expect(roundR(0.375, 2)).toBe(0.38);
    expect(roundR(1234.5678, -2)).toBe(1200);
    expect(roundR(1250, -2)).toBe(1200);
    expect(roundR(1350, -2)).toBe(1400);
    expect(roundR(-1350, -2)).toBe(-1400);
    expect(roundR(Math.PI, 4)).toBe(3.1416);
    expect(roundR(Math.PI, 2.6)).toBe(3.142);
    expect(roundR(Math.PI, 0.4)).toBe(3);
  });

  it("returns x when it has no more digits at that position (15 significant digits)", () => {
    // 0.1 + 0.2 = 0.30000000000000004: binary exponent -2, log10(2) (0.5 - 2) + 15 < 15, rounded; with 16 digits not
    expect(roundR(0.1 + 0.2, 15)).toBe(0.3);
    expect(roundR(0.1 + 0.2, 16)).toBe(0.1 + 0.2);
    expect(roundR(123456.123456789, 11)).toBe(123456.123456789);
    expect(roundR(1e300, 2)).toBe(1e300);
    // the smallest subnormal is far below 1e-300: 0
    expect(roundR(5e-324, 300)).toBe(0);
    expect(roundR(-5e-324, 300)).toBe(-0);
    const r = roundR(1.2345678e-20, 25);
    expect(Math.abs(r - 1.23457e-20) / 1.23457e-20).toBeLessThan(1e-15);
  });

  it("agrees with the correctly rounded decimal away from ties, on many values", () => {
    // a deterministic sequence of values with up to 6 decimal digits of noise beyond the rounding position
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let checked = 0;
    for (let k = 0; k < 20000; k++) {
      const digits = Math.floor(next() * 12);
      const x = (next() - 0.5) * 10 ** Math.floor(next() * 8 - 2);
      if (x === 0) continue;
      const p = 10 ** digits;
      const frac = Math.abs(x) * p - Math.floor(Math.abs(x) * p);
      if (Math.abs(frac - 0.5) < 1e-6) continue; // near a tie the double arithmetic decides
      if (Math.log10(Math.abs(x)) + digits > 14) continue; // returned unchanged
      expect(roundR(x, digits)).toBe(Number(x.toFixed(digits)));
      checked++;
    }
    expect(checked).toBeGreaterThan(15000);
  });

  it("zapsmall rounds to max(0, 7 - log10(max |x|)) digits", () => {
    expect(zapsmall([[1, 1e-17, -1e-9, 1 / 3]])).toEqual([[1, 0, -0, 0.3333333]]);
    expect(zapsmall([[2.8284271247461903, 0.7071067811865476, 6e-8]])).toEqual([[2.8284271, 0.7071068, 1e-7]]);
    expect(zapsmall([[123456789.123, 0.4]])).toEqual([[123456789, 0]]);
    expect(zapsmall([[0, 0], [NaN, 1e-8]])).toEqual([[0, 0], [NaN, 1e-8]]);
    expect(zapsmall([[0, 1.23456789e-8]])).toEqual([[0, 1.2345679e-8]]);
  });
});
