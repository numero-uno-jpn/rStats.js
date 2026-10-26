import type { AnovaTable } from "./anovaSequential.js";
import type { LmFormulaResult } from "./lm.js";
/** Options for {@link Anova}. */
export interface AnovaOptions {
    /** The type of the tests: 2 (default, as car) or 3; `"II"` and `"III"` are accepted too. */
    type?: 2 | 3 | "II" | "III";
}
/**
 * Type II or type III tests of the terms of a linear model, equivalent to `car::Anova(fit, type = 2)` or `type = 3`
 * for an `lm` fit. Columns `Sum Sq`, `Df`, `F value`, `Pr(>F)`; rows the terms (type III: `(Intercept)` first when the
 * model has one) and `Residuals`.
 *
 * Type II tests each term after all the others except the terms that contain it (car's marginality; it does not
 * depend on the contrasts). Type III tests each column set of the model's own matrix after all the other columns, so
 * it depends on the contrasts (`contr.sum` is the usual choice).
 *
 * Errors as car: `residual df = 0`, `residual sum of squares is 0 (within rounding error)`, and for type III `there
 * are aliased coefficients in the model`. Type II of a model with only an intercept gives the type III table with a
 * warning.
 *
 * @param fit A fit from {@link lm} with a formula.
 *
 * @example
 * ```ts
 * const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.1, 7.2], A: ["a", "a", "b", "b", "a", "a", "b", "b"], B: ["p", "q", "p", "q", "p", "q", "p", "q"] };
 * const t = Anova(lm("y ~ A * B", data, { contrasts: { A: "contr.sum", B: "contr.sum" } }), { type: 3 });
 * t.rowNames; // ["(Intercept)", "A", "B", "A:B", "Residuals"]
 * ```
 */
export declare function Anova(fit: LmFormulaResult, options?: AnovaOptions): AnovaTable;
