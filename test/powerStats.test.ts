// power.t.test, power.prop.test and power.anova.test against R (oracle/power.R)
import { describe, expect, it } from "vitest";
import { powerAnovaTest, powerPropTest, powerTTest } from "../src/index.js";
import { Comparison, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";
import { comparePowerCase, optionsOf } from "./helpers/power.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const PNT = "R's noncentral pt is accurate to only about 1e-12";
const PNT_ROOT = `${PNT}; uniroot's iterates follow the function values, so R's root moves with it`;
const PNF = "R's noncentral pf (pnbeta) is accurate to only about 1e-9";
const PNF_ROOT = `${PNF}; uniroot's iterates follow the function values, so R's root moves with it`;
const KNOWN: KnownDifference[] = [
  ...[9, 14, 19, 24, 29].map((c) => ({ case: c, table: "sigLevel", row: "0", col: "", reason: PNT_ROOT })),
  { case: 30, table: "power", row: "0", col: "", reason: `${PNT} (strict two-sided power)` },
  { case: 33, table: "power", row: "0", col: "", reason: `${PNT} (a small upper tail, 1e-6, with a negative ncp)` },
  { case: 35, table: "power", row: "0", col: "", reason: `${PNT} (199 998 degrees of freedom)` },
  { case: 37, table: "power", row: "0", col: "", reason: PNT },
  { case: 54, table: "power", row: "0", col: "", reason: PNF },
  { case: 55, table: "n", row: "0", col: "", reason: PNF_ROOT },
  { case: 56, table: "groups", row: "0", col: "", reason: PNF_ROOT },
  { case: 57, table: "betweenVar", row: "0", col: "", reason: PNF_ROOT },
  { case: 58, table: "withinVar", row: "0", col: "", reason: PNF_ROOT },
  { case: 59, table: "sigLevel", row: "0", col: "", reason: PNF_ROOT },
];

const fixture = loadAnovaFixture("powerStats");
const FUNCTIONS: Record<string, (o: never) => object> = {
  "power.t.test": powerTTest,
  "power.prop.test": powerPropTest,
  "power.anova.test": powerAnovaTest,
};

describe("powerStats", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const fn = FUNCTIONS[c.args.fn as string]!;
      if (comparePowerCase(cmp, index, c, () => fn(optionsOf(c.args) as never) as Record<string, unknown>)) errors++;
    });
    console.log(cmp.summary("powerStats", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});
