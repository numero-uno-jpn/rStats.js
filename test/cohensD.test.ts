// Cohen's d and Hedges' g (effectsize's cohens_d and hedges_g) against R (oracle/effectsize.R)
//
// The value is compared with R's; the interval limits with the fixture's reference (the exact noncentrality roots;
// effectsize's own limits are only about 1e-9 accurate), as oracle/effectsize-behaviour.md specifies.
import { describe, expect, it } from "vitest";
import { cohensD, hedgesG, type CohensDOptions } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const KNOWN: KnownDifference[] = [];
const TOL = 1e-12;

const fixture = loadAnovaFixture("cohensD");

describe("cohensD", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let maxLimit = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const e = c.expected as Record<string, string | string[]>;
      const options: CohensDOptions = {
        ...(a.pooled_sd === undefined ? {} : { pooledSd: a.pooled_sd as boolean }),
        ...(a.mu === undefined ? {} : { mu: num(a.mu as string) }),
        ...(a.paired === undefined ? {} : { paired: a.paired as boolean }),
        ...(a.adjust === undefined ? {} : { adjust: a.adjust as boolean }),
        ...(a.ci === undefined ? {} : { ci: a.ci === "NULL" ? null : num(a.ci as string) }),
        ...(a.alternative === undefined ? {} : { alternative: a.alternative as string }),
      };
      const x = (a.x as string[]).map(num);
      const y = a.y === undefined ? undefined : (a.y as string[]).map(num);
      const r = a.fn === "hedges_g" ? hedgesG(x, y, options) : cohensD(x, y, options);
      cmp.strings(index, "name", e.name, r.name);
      cmp.numbers(index, "value", e.value, r.value);
      cmp.strings(index, "warnings", e.warnings, r.warnings);
      const ciFields = ["ci", "ciLow", "ciHigh"].filter((k) => k in r);
      cmp.strings(index, "fields", Object.keys(e).filter((k) => k.startsWith("CI")), ciFields.map((k) => ({ ci: "CI", ciLow: "CI_low", ciHigh: "CI_high" })[k]));
      if (e.CI === undefined) return;
      cmp.numbers(index, "ci", e.CI, r.ci);
      // the limits against the reference: within a relative 1e-12, or 1e-12 absolute when the reference is 0
      for (const [k, v] of [["CI_low", r.ciLow!], ["CI_high", r.ciHigh!]] as const) {
        const ref = num(c.reference![k] as string);
        cmp.cells++;
        const err = ref === 0 ? Math.abs(v) : Object.is(ref, v) ? 0 : Math.abs(v - ref) / Math.abs(ref);
        if (Number.isFinite(err)) maxLimit = Math.max(maxLimit, err);
        const rErr = Number.isFinite(ref) ? Math.abs(v - num(e[k] as string)) / Math.abs(num(e[k] as string)) : 0;
        if (Number.isFinite(rErr)) cmp.maxRelR = Math.max(cmp.maxRelR, rErr);
        if (!(err <= TOL)) cmp.fail(index, `${k} vs reference`, ref, v);
      }
    });
    cmp.maxRelRef = Math.max(cmp.maxRelRef, maxLimit);
    console.log(cmp.summary("cohensD", fixture.cases.length, 0));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});

describe("cohensD options", () => {
  it("adjust gives Hedges' g", () => {
    const x = [5.1, 4.9, 6.2, 5.8, 6.0];
    const y = [4.1, 4.5, 3.9, 5.0, 4.4];
    expect(cohensD(x, y, { adjust: true })).toEqual(hedgesG(x, y));
  });
});
