// The power calculations of the pwr package and its effect-size helpers against R (oracle/pwr.R)
import { describe, expect, it } from "vitest";
import {
  cohenES,
  esH,
  esW1,
  esW2,
  pwr2p2nTest,
  pwr2pTest,
  pwrAnovaTest,
  pwrChisqTest,
  pwrF2Test,
  pwrNormTest,
  pwrPTest,
  pwrRTest,
  pwrT2nTest,
  pwrTTest,
} from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { Comparison, loadAnovaFixture, type KnownDifference } from "./helpers/anova.js";
import { comparePowerCase, optionsOf } from "./helpers/power.js";

/** Values that differ from R by more than 1e-12 but are within 1e-12 of the reference */
const PNF = "R's noncentral pf (pnbeta) is accurate to only about 1e-9";
const PNF_ROOT = `${PNF}; uniroot's iterates follow the function values, so R's root moves with it`;
const KNOWN: KnownDifference[] = [
  { case: 110, table: "power", row: "0", col: "", reason: "R's noncentral pt is accurate to only about 1e-12 (19 998 degrees of freedom)" },
  { case: 129, table: "power", row: "0", col: "", reason: PNF },
  { case: 130, table: "n", row: "0", col: "", reason: PNF_ROOT },
  { case: 131, table: "k", row: "0", col: "", reason: PNF_ROOT },
  { case: 132, table: "f", row: "0", col: "", reason: PNF_ROOT },
  { case: 133, table: "sigLevel", row: "0", col: "", reason: PNF_ROOT },
  { case: 136, table: "power", row: "0", col: "", reason: PNF },
  { case: 137, table: "v", row: "0", col: "", reason: PNF_ROOT },
  { case: 139, table: "f2", row: "0", col: "", reason: PNF_ROOT },
  { case: 140, table: "sigLevel", row: "0", col: "", reason: PNF_ROOT },
];

const fixture = loadAnovaFixture("pwr");
const nums = (v: unknown): number[] => (v as string[]).map(num);
const FUNCTIONS: Record<string, (a: Record<string, unknown>) => object> = {
  "pwr.t.test": (a) => pwrTTest(optionsOf(a)),
  "pwr.t2n.test": (a) => pwrT2nTest(optionsOf(a)),
  "pwr.2p.test": (a) => pwr2pTest(optionsOf(a)),
  "pwr.2p2n.test": (a) => pwr2p2nTest(optionsOf(a)),
  "pwr.p.test": (a) => pwrPTest(optionsOf(a)),
  "pwr.norm.test": (a) => pwrNormTest(optionsOf(a)),
  "pwr.r.test": (a) => pwrRTest(optionsOf(a)),
  "pwr.chisq.test": (a) => pwrChisqTest(optionsOf(a) as never),
  "pwr.anova.test": (a) => pwrAnovaTest(optionsOf(a)),
  "pwr.f2.test": (a) => pwrF2Test(optionsOf(a)),
  "ES.h": (a) => ({ value: esH(num(a.p1 as string), num(a.p2 as string)) }),
  "ES.w1": (a) => ({ value: esW1(nums(a.P0), nums(a.P1)) }),
  "ES.w2": (a) => ({ value: esW2((a.P as string[][]).map(nums)) }),
  "cohen.ES": (a) => cohenES(a.test as string, a.size as string),
};

describe("pwr", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const fn = FUNCTIONS[c.args.fn as string]!;
      if (comparePowerCase(cmp, index, c, () => fn(c.args) as Record<string, unknown>)) errors++;
    });
    console.log(cmp.summary("pwr", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 40).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});
