// dunn.test against R (oracle/mcomp.R, fixture mcompDunn; rules in test/helpers/mcomp.ts)
import { describe, expect, it } from "vitest";
import { dunnTest, type DunnTestMethod } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { loadMcompFixture, McompComparison } from "./helpers/mcomp.js";

const fixture = loadMcompFixture("mcompDunn");

describe("mcompDunn", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new McompComparison();
    let tied = 0;
    fixture.cases.forEach((c, i) => {
      const a = c.args;
      const e = c.expected;
      // dunn.test warned on none of these inputs (dunnTest reports no warnings)
      expect(e.warnings, `#${i} warnings`).toEqual([]);
      const r = dunnTest((a.x as string[]).map(num), a.g as string[], { method: a.method as DunnTestMethod, altp: a.altp as boolean });
      cmp.strings(i, "comparisons", e.comparisons, r.comparisons);
      cmp.numbers(i, "chi2", e.chi2, r.chi2);
      cmp.numbers(i, "Z", e.Z, r.Z);
      cmp.numbers(i, "P", e.P, r.P);
      // dunn.test ranks tied p-values in the order of the comparisons; dunnTest gives a run of ties the rank of its
      // first (review_fix_log_20261031_60.md), whose value is dunn.test's at the first comparison of the run
      const P = e.P as string[];
      const adjusted = e["P.adjusted"] as string[];
      const stepwise = ["holm", "hs", "hochberg", "bh", "by"].includes(a.method as string);
      const expected = adjusted.map((v, k) => (stepwise ? adjusted[P.indexOf(P[k]!)]! : v));
      if (expected.some((v, k) => v !== adjusted[k])) tied++;
      cmp.numbers(i, "PAdjusted", expected, r.PAdjusted);
    });
    cmp.check("mcompDunn", fixture.cases.length);
    expect(tied).toBe(10);
  });
});
