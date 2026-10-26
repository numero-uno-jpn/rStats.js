// multcomp's Dunnett contrasts against R (oracle/mcomp.R, fixture mcompDunnett; rules in test/helpers/mcomp.ts)
import { describe, it } from "vitest";
import { glhtDunnett, type Alternative } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { loadMcompFixture, McompComparison } from "./helpers/mcomp.js";

const fixture = loadMcompFixture("mcompDunnett");

describe("mcompDunnett", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new McompComparison();
    fixture.cases.forEach((c, i) => {
      const a = c.args;
      const e = c.expected;
      const r = glhtDunnett((a.x as string[]).map(num), a.g as string[], { alternative: a.alternative as Alternative });
      cmp.strings(i, "names", e.names, r.names);
      cmp.numbers(i, "estimate", e.estimate, r.estimate);
      cmp.numbers(i, "se", e.se, r.se);
      cmp.numbers(i, "t", e.t, r.t);
      cmp.numbers(i, "df", e.df, r.df);
      cmp.numbers(i, "p", e.p, r.p, c.reference?.p, true);
    });
    cmp.check("mcompDunnett", fixture.cases.length);
  });
});
