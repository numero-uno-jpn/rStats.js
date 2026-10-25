// afex's aov_ez (anova table) with car's univariate tests, corrections and Mauchly tests against R (oracle/aovez.R)
import { describe, expect, it } from "vitest";
import { aovEz, type AovEzEffectSize, type AovEzOptions } from "../src/index.js";
import { Comparison, dataFrameOf, loadAnovaFixture, type FixtureTable, type KnownDifference } from "./helpers/anova.js";

/** Cells that differ from R by more than 1e-12 but are within 1e-12 of the exact reference */
const KNOWN: KnownDifference[] = [];

/** Errors compared on their first line only (R prints a table after it; see oracle/anova-behaviour.md) */
const FIRST_LINE = ["Rank deficient model matrix;", "Empty cells in within-subjects design"];
/** Warnings compared up to (excluding) this text */
const MISSING_IDS = "Missing values for ";
const BELOW = "\nBelow the first few rows";

const fixture = loadAnovaFixture("aovEz");

const strs = (v: unknown): string[] | undefined => (v === undefined ? undefined : ([] as string[]).concat(v as string | string[]));

describe("aovEz", () => {
  it(`matches R (${fixture.r_version})`, () => {
    const cmp = new Comparison(KNOWN);
    let errors = 0;
    fixture.cases.forEach((c, index) => {
      const a = c.args;
      const options: AovEzOptions = {
        id: a.id as string,
        dv: a.dv as string,
        ...(a.between === undefined ? {} : { between: strs(a.between)! }),
        ...(a.within === undefined ? {} : { within: strs(a.within)! }),
        ...(a.type === undefined ? {} : { type: Number(a.type) as 2 | 3 }),
        ...(a.correction === undefined ? {} : { correction: a.correction as "GG" | "HF" | "none" }),
        ...(a.es === undefined ? {} : { es: strs(a.es) as AovEzEffectSize[] }),
        ...(a.observed === undefined ? {} : { observed: strs(a.observed)! }),
      };
      const e = c.expected;
      let r;
      try {
        r = aovEz(dataFrameOf(a.data, a.dataTypes), options);
      } catch (err) {
        const msg = (err as Error).message;
        const want = e.error as string | undefined;
        if (want === undefined) return cmp.fail(index, "(exception)", "result", msg);
        errors++;
        const firstLine = FIRST_LINE.some((p) => want.startsWith(p));
        if (firstLine ? msg.split("\n")[0] !== want.split("\n")[0] : msg !== want) cmp.fail(index, "error", want, msg);
        return;
      }
      if (e.error !== undefined) return cmp.fail(index, "(exception)", e.error, "no exception thrown");
      const ref = c.reference as Record<string, FixtureTable> | undefined;
      for (const t of ["anova", "univariate", "corrections", "sphericity"] as const) {
        const exp = e[t] as FixtureTable | undefined;
        const act = r[t];
        if (exp === undefined || act === undefined) {
          if (exp !== act) cmp.fail(index, t, exp === undefined ? "absent" : "present", act === undefined ? "absent" : "present");
          continue;
        }
        cmp.table(index, t, exp, act, ref?.[t], false);
      }
      const cut = (w: string): string => (w.startsWith(MISSING_IDS) && w.includes(BELOW) ? w.slice(0, w.indexOf(BELOW)) : w);
      cmp.strings(index, "warnings", (e.warnings as string[]).map(cut), r.warnings.map(cut));
    });
    console.log(cmp.summary("aovEz", fixture.cases.length, errors));
    expect(cmp.failures, cmp.failures.slice(0, 30).join("\n")).toEqual([]);
    expect(cmp.unused(), "known differences that are not needed").toEqual([]);
  });
});
