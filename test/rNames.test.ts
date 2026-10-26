// Every exported function's doc comment names its R counterpart in exactly one sentence of a fixed form, so that
// scripts/r-index.mjs can list them:
//   Equivalent to R's `t.test()`.            (base R and recommended packages; several: `dnorm()`, `pnorm()`;
//                                            the call may show arguments: `dbeta(x, shape1, shape2)`)
//   Equivalent to `car::Anova()` in R.       (other packages, with the package name)
//   Not an R function.                       (a reason may follow in the next sentence)
// Over the overloads of a function there is one such sentence in all.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectFunctions, rSentences } from "./helpers/docComments.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const functions = collectFunctions(root);

/**
 * An R function call `name()` or `name(x, y)` (`pkg::name()` for a package), an operator such as `%*%` or `+`, or
 * `.Random.seed`.
 */
const R_NAME = /^(?:(?:[A-Za-z][\w.]*::)?[A-Za-z.][\w.]*\(.*\)|%[^%\s]+%|[-+*/]|\.Random\.seed)$/;

describe("R's name in the doc comments", () => {
  it("every exported function has exactly one sentence naming R's counterpart", () => {
    const problems: string[] = [];
    for (const f of functions) {
      const { sentences, invalid } = rSentences(f.comments);
      if (invalid.length > 0) problems.push(`${f.name}: not in a fixed form: ${invalid.join(" | ")}`);
      if (sentences.length !== 1) problems.push(`${f.name}: ${sentences.length} sentences naming R's counterpart`);
      for (const s of sentences) {
        for (const n of s.codes) if (!R_NAME.test(n)) problems.push(`${f.name}: "${n}" is not an R function name`);
        if (s.kind === "package" && s.names.some((n) => !n.includes("::"))) problems.push(`${f.name}: no package`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("finds missing, repeated and malformed sentences", () => {
    expect(rSentences(["Student's t-test. Equivalent to R's `t.test()`."]).sentences).toHaveLength(1);
    expect(rSentences(["Equivalent to R's `dnorm()`, `pnorm()` and `qnorm()`. More."]).sentences[0]!.names).toEqual([
      "dnorm()", "pnorm()", "qnorm()",
    ]);
    expect(rSentences(["Equivalent to `car::Anova()` in R."]).sentences[0]!.kind).toBe("package");
    expect(rSentences(["Not an R function. JavaScript has no data frames."]).sentences[0]!.kind).toBe("none");
    expect(rSentences(["A test.", "Equivalent to R's `t.test(formula, data)`: the formula form."]).invalid).toHaveLength(1);
    expect(rSentences(["Equivalent to car's `Anova()`."]).invalid).toHaveLength(1);
    expect(rSentences(["No reference."]).sentences).toHaveLength(0);
  });

  it("the index script lists every function", () => {
    const md = execFileSync(process.execPath, [`${root}scripts/r-index.mjs`], { encoding: "utf8" });
    for (const f of functions) expect(md, f.name).toContain(`\`${f.name}\``);
    expect(md).toContain("| `t.test()` | `tTest` |");
  });
});
