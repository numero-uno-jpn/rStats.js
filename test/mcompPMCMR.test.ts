// PMCMRplus's multiple comparisons against R (oracle/mcomp.R, fixture mcompPMCMR; rules in test/helpers/mcomp.ts)
import { describe, it } from "vitest";
import {
  dscfAllPairsTest,
  dunnettTest,
  gamesHowellTest,
  kwAllPairsDunnTest,
  kwManyOneDunnTest,
  steelTest,
  tukeyTest,
  type Alternative,
  type PMCMRResult,
} from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { loadMcompFixture, McompComparison, type McompKnownDifference } from "./helpers/mcomp.js";

const fixture = loadMcompFixture("mcompPMCMR");

/**
 * Studentized-range p-values (dscfAllPairsTest, gamesHowellTest, tukeyTest) that differ from R by more than 1e-12 and
 * are within 1e-12 of the fixture's full-precision reference: case -> positions in the flattened p-value table (NaN
 * cells included).
 */
const RANGE_P: Record<number, number[]> = {
  0: [2],
  2: [2, 3],
  3: [2],
  17: [0, 4, 8],
  19: [0, 3, 4, 7, 8],
  20: [0, 4, 6],
  34: [0, 4, 5, 8, 10, 12, 13],
  36: [0, 4, 5, 8, 9, 10, 12, 13, 14, 15],
  37: [4, 5, 8, 9, 10, 12, 13, 14, 15],
  51: [2],
  53: [0, 2, 3],
  54: [0, 2, 3],
};
const KNOWN: McompKnownDifference[] = Object.entries(RANGE_P).flatMap(([c, idx]) =>
  idx.map((index) => ({ case: Number(c), field: "pValue", index, reason: "R's ptukey is accurate to only about 8 digits" })),
);

function run(a: Record<string, unknown>): PMCMRResult {
  const x = (a.x as string[]).map(num);
  const g = a.g as string[];
  const alt = a.alternative === undefined ? {} : { alternative: a.alternative as Alternative };
  const adj = a["p.adjust.method"] === undefined ? {} : { pAdjustMethod: a["p.adjust.method"] as string };
  switch (a.fn) {
    case "dscfAllPairsTest":
      return dscfAllPairsTest(x, g);
    case "kwAllPairsDunnTest":
      return kwAllPairsDunnTest(x, g, adj);
    case "kwManyOneDunnTest":
      return kwManyOneDunnTest(x, g, { ...alt, ...adj });
    case "dunnettTest":
      return dunnettTest(x, g, alt);
    case "gamesHowellTest":
      return gamesHowellTest(x, g);
    case "tukeyTest":
      return tukeyTest(x, g);
    case "steelTest":
      return steelTest(x, g, alt);
    default:
      throw new Error(`unknown function ${String(a.fn)}`);
  }
}

describe("mcompPMCMR", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new McompComparison(KNOWN);
    fixture.cases.forEach((c, i) => {
      const e = c.expected;
      if (e.error !== undefined) return cmp.error(i, e.error as string, () => run(c.args));
      const r = run(c.args);
      cmp.strings(i, "method", e.method, r.method);
      cmp.strings(i, "rowNames", e.rowNames, r.rowNames);
      cmp.strings(i, "colNames", e.colNames, r.colNames);
      cmp.strings(i, "pAdjustMethod", e["p.adjust.method"], r.pAdjustMethod);
      cmp.strings(i, "warnings", e.warnings, r.warnings);
      cmp.numbers(i, "statistic", e.statistic, r.statistic);
      // the Dunnett-type p-values (rule 1) against the reference only
      const dunnett =
        c.args.fn === "dunnettTest" || (c.args.fn === "kwManyOneDunnTest" && (c.args["p.adjust.method"] ?? "single-step") === "single-step");
      cmp.numbers(i, "pValue", e["p.value"], r.pValue, c.reference?.["p.value"], dunnett);
    });
    cmp.check("mcompPMCMR", fixture.cases.length);
  });
});
