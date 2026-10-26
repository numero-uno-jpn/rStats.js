// dunn.test against R (oracle/mcomp.R, fixture mcompDunn; rules in test/helpers/mcomp.ts)
import { describe, expect, it } from "vitest";
import { dunnTest, type DunnTestMethod } from "../src/index.js";
import { dunnAdjust } from "../src/htest/multipleComparisons.js";
import { num } from "./helpers/fixture.js";
import { loadMcompFixture, McompComparison, type McompCase } from "./helpers/mcomp.js";

const fixture = loadMcompFixture("mcompDunn");

/**
 * Cases whose chi2, Z and P disagree with the specification's statistics: on the first three data sets (values such
 * as 8.88, 9.48, 10.06) the fixture's values are what the Kruskal-Wallis statistic and Dunn's z give when the values
 * are ranked as character strings ("10.06" < "8.88" < "9.48"); on the fourth (single-digit integers, where that order
 * is the numeric one) they agree with rStats.js. Reported as a question about the fixture; these cases are checked only
 * for the parts that do not depend on the ranks (the comparisons and the adjustment of R's own P), and must keep
 * disagreeing, so that a regenerated fixture is noticed.
 */
const STRING_RANKED = new Set(Array.from({ length: 48 }, (_, i) => i));

function compare(cmp: McompComparison, i: number, c: McompCase): void {
  const a = c.args;
  const e = c.expected;
  const r = dunnTest((a.x as string[]).map(num), a.g as string[], { method: a.method as DunnTestMethod, altp: a.altp as boolean });
  cmp.numbers(i, "chi2", e.chi2, r.chi2);
  cmp.numbers(i, "Z", e.Z, r.Z);
  cmp.numbers(i, "P", e.P, r.P);
  cmp.numbers(i, "PAdjusted", e["P.adjusted"], r.PAdjusted);
}

describe("mcompDunn", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new McompComparison();
    fixture.cases.forEach((c, i) => {
      const a = c.args;
      const e = c.expected;
      // dunn.test warned on none of these inputs (dunnTest reports no warnings)
      expect(e.warnings, `#${i} warnings`).toEqual([]);
      const r = dunnTest((a.x as string[]).map(num), a.g as string[], { method: a.method as DunnTestMethod, altp: a.altp as boolean });
      cmp.strings(i, "comparisons", e.comparisons, r.comparisons);
      // the adjustment (no monotonicity step) of R's own P, on every case
      cmp.numbers(i, "PAdjusted of R's P", e["P.adjusted"], dunnAdjust((e.P as string[]).map(num), a.method as DunnTestMethod));
      if (!STRING_RANKED.has(i)) compare(cmp, i, c);
    });
    cmp.check("mcompDunn", fixture.cases.length);
  });

  it("the cases listed as ranked as strings still disagree", () => {
    const stillDifferent = [...STRING_RANKED].filter((i) => {
      const cmp = new McompComparison();
      compare(cmp, i, fixture.cases[i]!);
      return cmp.failures.length > 0;
    });
    expect(stillDifferent).toEqual([...STRING_RANKED]);
  });
});
