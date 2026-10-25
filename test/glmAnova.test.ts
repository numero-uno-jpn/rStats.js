// Analysis of deviance for glm against R (oracle/glmanova.R)
import { glmAnova, type GlmAnovaTest } from "../src/index.js";
import { arg, defined, htestSuite, loadHTestFixture, type HTestArg } from "./helpers/htest.js";
import { fitCase } from "./helpers/glm.js";

/** The case's fit with the columns `cols` (1-based) of x */
function fitColumns(a: Record<string, HTestArg>, cols: number[]): ReturnType<typeof fitCase> {
  const x = (a.x as string[][]).map((r) => cols.map((j) => r[j - 1]!));
  return fitCase({ ...a, x });
}

const cases = new Map(loadHTestFixture("glmAnova").cases.map((c) => [JSON.stringify(c.args), c.expected]));

htestSuite({
  name: "glmAnova",
  call: (a) => {
    const t = a.test;
    const test = (t === false ? false : arg.str(t)) as GlmAnovaTest | undefined;
    const opts = defined({ test, dispersion: arg.num(a.dispersion) });
    const compare = a.compare as string[] | undefined;
    const fit =
      compare === undefined
        ? fitCase(a)
        : compare.map((s) => fitColumns(a, s === "" ? [] : s.split(" ").map(Number)));
    return glmAnova(fit, opts);
  },
  tolerance: 1e-12,
  // deviances that cancel: the deviance of a term is a difference of residual deviances, and a saturated model has a
  // residual deviance of rounding residue (or where the iterations stopped): those columns are compared relative to the
  // largest residual deviance of the table (and so are the F statistics computed from them)
  knownDifference: (a, _field, expected, actual, k) => {
    const c = cases.get(JSON.stringify(a))!;
    const colNames = c.colNames as string[];
    const col = colNames[k % colNames.length]!;
    const table = (c.table as string[][]).map((r) => r.map(Number));
    const scale = Math.max(...table.map((r) => r[colNames.indexOf("Resid. Dev")]!));
    // F = deviance / (df dispersion) is compared on the scale of the deviance
    const row = table[Math.floor(k / colNames.length)]!;
    const toDeviance = col === "F" ? row[colNames.indexOf("Deviance")]! / expected : 1;
    return (col === "Deviance" || col === "Resid. Dev" || col === "F") && Math.abs(actual - expected) * toDeviance <= 1e-12 * scale
      ? "deviance that cancels (difference of residual deviances, or a saturated fit): agrees relative to the residual deviances"
      : undefined;
  },
});
