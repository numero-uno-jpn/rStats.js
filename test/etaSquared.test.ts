// Eta, omega and epsilon squared of ANOVA tables (effectsize's eta_squared, omega_squared, epsilon_squared) against R
// (oracle/effectsize.R)
//
// The effect sizes are compared with R's values; the interval limits with the fixture's reference (the exact
// noncentrality roots; effectsize's own limits are only about 1e-9 accurate), as oracle/effectsize-behaviour.md
// specifies.
import { describe, expect, it } from "vitest";
import { Anova, anova, epsilonSquared, etaSquared, lm, omegaSquared, type ContrastName } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, dataFrameOf, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const KNOWN: KnownDifference[] = [];
const TOL = 1e-12;

const fixture = loadAnovaFixture("etaSquared");

describe("etaSquared", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let errors = 0;
    let maxLimit = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected as { colNames?: string[]; rowNames?: string[]; table?: string[][]; warnings?: string[]; error?: string };
      const fit = lm(a.formula as string, dataFrameOf(a.data, a.dataTypes), { contrasts: a.contrasts as Record<string, ContrastName> });
      const tab = a.source === "anova" ? anova(fit) : Anova(fit, { type: a.source === "Anova2" ? 2 : 3 });
      const options = {
        ...(a.partial === undefined ? {} : { partial: a.partial as boolean }),
        ...(a.ci === undefined ? {} : { ci: a.ci === "NULL" ? null : num(a.ci as string) }),
        ...(a.alternative === undefined ? {} : { alternative: a.alternative as string }),
        ...(a.generalized === undefined ? {} : { generalized: typeof a.generalized === "string" ? [a.generalized] : (a.generalized as boolean) }),
      };
      let r;
      try {
        r = a.fn === "eta_squared" ? etaSquared(tab, options) : a.fn === "omega_squared" ? omegaSquared(tab, options) : epsilonSquared(tab, options);
      } catch (err) {
        const msg = (err as Error).message;
        if (e.error === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        if (msg !== e.error) cmp.fail(index, "error", e.error, msg);
        return;
      }
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      cmp.strings(index, "colNames", e.colNames, r.colNames);
      cmp.strings(index, "rowNames", e.rowNames, r.rowNames);
      cmp.strings(index, "warnings", e.warnings, r.warnings);
      const rows = e.table!;
      if (rows.length !== r.table.length) return cmp.fail(index, "table (shape)", rows, r.table);
      rows.forEach((row, i) => {
        // the effect size and the level against R
        cmp.numbers(index, `${e.rowNames![i]}`, row.slice(0, Math.min(2, row.length)), r.table[i]!.slice(0, Math.min(2, row.length)));
        if (row.length < 4) return;
        // the limits against the reference: within a relative 1e-12, or 1e-12 absolute when the reference is 0
        const ref = c.reference as { CI_low: string[]; CI_high: string[] };
        for (const [k, j] of [["CI_low", 2], ["CI_high", 3]] as const) {
          const rv = num(ref[k][i]!);
          const v = r.table[i]![j]!;
          cmp.cells++;
          const err = rv === 0 ? Math.abs(v) : Math.abs(v - rv) / Math.abs(rv);
          maxLimit = Math.max(maxLimit, err);
          const ev = num(row[j]!);
          if (ev !== 0) cmp.maxRelR = Math.max(cmp.maxRelR, Math.abs(v - ev) / Math.abs(ev));
          if (!(err <= TOL)) cmp.fail(index, `${e.rowNames![i]} ${k} vs reference`, rv, v);
        }
      });
    });
    cmp.maxRelRef = Math.max(cmp.maxRelRef, maxLimit);
    console.log(cmp.summary("etaSquared", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 40).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});

describe("etaSquared options", () => {
  it("takes a fit from lm() as its anova() table", () => {
    const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.6, 7.0, 5.5], g: ["a", "a", "a", "b", "b", "b", "c", "c", "c"] };
    const fit = lm("y ~ g", data);
    expect(etaSquared(fit)).toEqual(etaSquared(anova(fit)));
  });
});
