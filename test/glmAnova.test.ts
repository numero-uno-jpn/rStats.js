// Analysis of deviance of glm against R (oracle/glmanova.R): the sequential table of one fit and comparisons of fits
import { glm, glmAnova, type GlmAnovaTest, type GlmResult } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { devianceScale, glmArgs } from "./helpers/glm.js";
import { arg, defined, htestSuite, type HTestCase } from "./helpers/htest.js";

/** The fits of the rows of a case's table (undefined for the NULL row of a sequential table) */
function rowFits(a: HTestCase["args"]): (GlmResult | undefined)[] {
  const { x, y, options } = glmArgs(a);
  const colsOf = (cs: string) => (cs === "" ? [] : cs.split(" ").map((v) => Number(v) - 1));
  const sets =
    a.compare === undefined
      ? [undefined, ...Array.from({ length: x[0]!.length }, (_, k) => Array.from({ length: k + 1 }, (_, j) => j))]
      : (typeof a.compare === "string" ? [a.compare] : (a.compare as string[])).map(colsOf);
  return sets.map((cols) => (cols === undefined ? undefined : glm(x.map((r) => cols.map((j) => r[j]!)), y, options)));
}

/**
 * Floors of the table's cells (|difference| / max(|R's value|, floor)): a residual deviance is known to eps times its
 * rounding scale (devianceScale in test/helpers/glm.ts; it matters for saturated fits, whose deviance is rounding
 * residue or converging to 0), a "Deviance" cell is the difference of two residual deviances and cancels when they are
 * close (floor: their sum and their scales), and the F value is that cell divided by Df and the dispersion.
 */
function tableFloors(c: HTestCase): number[] {
  const cols = c.expected.colNames as string[];
  const tab = (c.expected.table as string[][]).map((r) => r.map(num));
  const fits = rowFits(c.args);
  const iRes = cols.indexOf("Resid. Dev");
  const iDev = cols.indexOf("Deviance");
  const iF = cols.indexOf("F");
  return tab.flatMap((row, i) => {
    const scale = fits[i] === undefined ? 0 : devianceScale(fits[i]!);
    const devFloor = i === 0 ? 0 : Math.abs(tab[i - 1]![iRes]!) + Math.abs(row[iRes]!) + scale + (fits[i - 1] === undefined ? 0 : devianceScale(fits[i - 1]!));
    return row.map((v, j) => {
      if (j === iRes) return scale;
      if (j === iDev) return devFloor;
      if (j === iF && row[iDev] !== 0) return (Math.abs(v) * devFloor) / Math.abs(row[iDev]!);
      return 0;
    });
  });
}

function run(a: HTestCase["args"]): Record<string, unknown> {
  const { x, y, options } = glmArgs(a);
  const test: GlmAnovaTest | false | undefined = a.test === false ? false : arg.str<GlmAnovaTest>(a.test);
  const opts = defined({ test, dispersion: arg.num(a.dispersion) });
  const warnings: string[] = [];
  const note = (ws: string[]) => ws.forEach((m) => warnings.includes(m) || warnings.push(m));
  let tab;
  if (a.compare === undefined) {
    const fit = glm(x, y, options);
    note(fit.warnings);
    tab = glmAnova(fit, opts);
  } else {
    // each model: the columns of x listed (1-based, space-separated; "" for the intercept only)
    const compare = typeof a.compare === "string" ? [a.compare] : (a.compare as string[]);
    const fits = compare.map((cs) => {
      const cols = cs === "" ? [] : cs.split(" ").map((v) => Number(v) - 1);
      const fit = glm(x.map((r) => cols.map((j) => r[j]!)), y, options);
      note(fit.warnings);
      return fit;
    });
    tab = glmAnova(fits, opts);
  }
  note(tab.warnings);
  return { colNames: tab.colNames, rowNames: tab.rowNames, table: tab.table, warnings };
}

htestSuite({
  name: "glmAnova",
  call: run,
  tolerance: 1e-12,
  floor: { table: tableFloors },
});
