// Eta, omega and epsilon squared of repeated-measures designs (effectsize's eta_squared, omega_squared and
// epsilon_squared for aov with Error() and for afex's aov_ez) against R (oracle/effectsizerm.R: fixtures
// etaSquaredStrata and etaSquaredEz)
//
// The effect sizes are compared with R's values; the interval limits with the fixture's reference (the exact
// noncentrality roots; effectsize's own limits are only about 1e-9 accurate), as oracle/effectsize-behaviour.md and
// oracle/rm-tests-behaviour.md specify.
import { describe, expect, it } from "vitest";
import {
  aov,
  aovEz,
  aovSummary,
  epsilonSquared,
  etaSquared,
  omegaSquared,
  type AnovaEffectSizeModel,
  type AnovaEffectSizeTable,
  type AovStrataFit,
} from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, dataFrameOf, loadAnovaFixture, type AnovaCase, type KnownDifference } from "./helpers/anova.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const KNOWN_STRATA: KnownDifference[] = [];
const KNOWN_EZ: KnownDifference[] = [];
const TOL = 1e-12;

function effectSize(a: AnovaCase["args"], model: AnovaEffectSizeModel): AnovaEffectSizeTable {
  const options = {
    ...(a.partial === undefined ? {} : { partial: a.partial as boolean }),
    ...(a.ci === undefined ? {} : { ci: a.ci === "NULL" ? null : num(a.ci as string) }),
    ...(a.alternative === undefined ? {} : { alternative: a.alternative as string }),
    ...(a.generalized === undefined ? {} : { generalized: typeof a.generalized === "string" ? [a.generalized] : (a.generalized as boolean) }),
  };
  if (a.fn === "eta_squared") return etaSquared(model, options);
  if (a.fn === "omega_squared") return omegaSquared(model, options);
  return epsilonSquared(model, options);
}

function check(name: string, known: KnownDifference[], model: (a: AnovaCase["args"]) => AnovaEffectSizeModel): void {
  const fixture = loadAnovaFixture(name);
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(known);
    let errors = 0;
    let maxLimit = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected as { colNames?: string[]; rowNames?: string[]; groups?: string[]; table?: string[][]; warnings?: string[]; error?: string };
      let r;
      try {
        r = effectSize(a, model(a));
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
      cmp.strings(index, "groups", e.groups, r.groups);
      cmp.strings(index, "warnings", e.warnings, r.warnings);
      const rows = e.table!;
      if (rows.length !== r.table.length) return cmp.fail(index, "table (shape)", rows, r.table);
      rows.forEach((row, i) => {
        if (row.length !== r.table[i]!.length) return cmp.fail(index, `${e.rowNames![i]} (shape)`, row, r.table[i]);
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
    console.log(cmp.summary(name, fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 40).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
}

const list = (v: unknown): string[] | undefined => (v === undefined ? undefined : typeof v === "string" ? [v] : (v as string[]));

describe("etaSquared of aov with Error()", () => {
  check("etaSquaredStrata", KNOWN_STRATA, (a) => aov(a.formula as string, dataFrameOf(a.data, a.dataTypes)) as AovStrataFit);

  it("takes the summary of the fit as the fit", () => {
    const data = {
      id: ["s1", "s1", "s1", "s2", "s2", "s2", "s3", "s3", "s3", "s4", "s4", "s4"],
      W: ["a", "b", "c", "a", "b", "c", "a", "b", "c", "a", "b", "c"],
      y: [4.1, 5.0, 5.9, 3.8, 4.9, 5.1, 4.4, 5.6, 6.6, 4.0, 4.7, 5.2],
    };
    const fit = aov("y ~ W + Error(id/W)", data) as AovStrataFit;
    expect(omegaSquared(aovSummary(fit), { ci: null })).toEqual(omegaSquared(fit, { ci: null }));
  });
});

describe("etaSquared of aovEz", () => {
  check("etaSquaredEz", KNOWN_EZ, (a) => {
    const between = list(a.between);
    const within = list(a.within);
    return aovEz(dataFrameOf(a.data, a.dataTypes), {
      id: a.id as string,
      dv: a.dv as string,
      ...(between === undefined ? {} : { between }),
      ...(within === undefined ? {} : { within }),
    });
  });
});
