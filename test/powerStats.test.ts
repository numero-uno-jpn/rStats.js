// power.t.test, power.prop.test and power.anova.test against R (oracle/power.R)
import { describe, expect, it } from "vitest";
import { powerAnovaTest, powerPropTest, powerTTest } from "../src/index.js";
import { Comparison, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";
import { comparePowerCase, optionsOf } from "./helpers/power.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const KNOWN: KnownDifference[] = [];

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
