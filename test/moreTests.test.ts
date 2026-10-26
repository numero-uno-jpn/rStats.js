// Levene's test (car), the chi-squared test for trend in proportions (stats), the Jonckheere-Terpstra test (clinfun
// and DescTools), Cochran's Q (DescTools) and the normality tests of nortest against R (oracle/moretests.R: fixture
// moreTests). Every value must be within a relative 1e-12 of R's (oracle/rm-tests-behaviour.md, "Accuracy").
import { describe, expect, it } from "vitest";
import {
  adTest,
  cochranQTest,
  cvmTest,
  jonckheereTest,
  leveneTest,
  lillieTest,
  pearsonTest,
  propTrendTest,
  sfTest,
} from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

const strs = (a: HTestArg | undefined): string[] => a as string[];
/** Results of functions that give no warnings, with R's (empty) list of warnings */
const noWarnings = <T extends object>(r: T): T & { warnings: string[] } => ({ ...r, warnings: [] });

htestSuite({
  name: "moreTests",
  tolerance: 1e-12,
  call: (a) => {
    switch (a.fn) {
      case "leveneTest":
        return noWarnings(leveneTest(arg.vec(a.y)!, strs(a.g), defined({ center: arg.str(a.center) })));
      case "prop.trend.test":
        return noWarnings(propTrendTest(arg.vec(a.x)!, arg.vec(a.n)!, arg.vec(a.score)));
      case "jonckheere.test":
        return jonckheereTest(arg.vec(a.x)!, strs(a.g), { alternative: arg.str(a.alternative)!, variant: "clinfun" });
      case "JonckheereTerpstraTest":
        return jonckheereTest(arg.vec(a.x)!, strs(a.g), defined({ alternative: arg.str(a.alternative), exact: arg.bool(a.exact) }));
      case "CochranQTest":
        return noWarnings(cochranQTest(arg.mat(a.y)!));
      case "ad.test":
        return noWarnings(adTest(arg.vec(a.x)!));
      case "lillie.test":
        return noWarnings(lillieTest(arg.vec(a.x)!));
      case "cvm.test":
        return cvmTest(arg.vec(a.x)!);
      case "sf.test":
        return noWarnings(sfTest(arg.vec(a.x)!));
      case "pearson.test":
        return noWarnings(pearsonTest(arg.vec(a.x)!));
      default:
        throw new Error(`unknown function ${String(a.fn)}`);
    }
  },
});

describe("moreTests options and errors", () => {
  it("rejects samples that are too small", () => {
    const x = [1.2, 3.4, 2.2, 5.1, 4.0, 2.8, 3.9];
    expect(() => adTest(x)).toThrow("sample size must be greater than 7");
    expect(() => cvmTest(x)).toThrow("sample size must be greater than 7");
    expect(() => lillieTest(x.slice(0, 4))).toThrow("sample size must be greater than 4");
    expect(() => sfTest(x.slice(0, 4))).toThrow("sample size must be between 5 and 5000");
  });

  it("orders the Jonckheere groups by explicit levels", () => {
    const x = [1.1, 2.0, 2.4, 3.5, 3.1, 4.6];
    const up = jonckheereTest(x, ["a", "a", "b", "b", "c", "c"]);
    const down = jonckheereTest(x, ["a", "a", "b", "b", "c", "c"], { levels: ["c", "b", "a"] });
    expect(up.statistic + down.statistic).toBe(12);
    expect(down.pValue).toBeCloseTo(up.pValue, 15);
  });
});
