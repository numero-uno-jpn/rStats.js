/**
 * A function that receives R's warnings: the warning's text and the name of the function that gave it, once per
 * distinct warning of a call, after the call has computed its result.
 *
 * @category Hypothesis tests
 */
export type WarningHandler = (message: string, source: string) => void;
/**
 * Sets the function that receives R's warnings, and returns the one it replaces (`null` when there was none). Not an
 * R function. It plays the part of R's printing of warnings (and, by throwing, of `options(warn = 2)`).
 *
 * Every test, model and fit returns R's warnings in its result's `warnings` whatever the handler. With a handler
 * set, each call of such a function (and `pivotLonger` without `onWarning`) also passes its warnings to the handler
 * once it has computed its result: each distinct warning once, in order, with the name of the function called (a
 * function that calls another, such as `pairwiseWilcoxTest`, passes the warnings once, under its own name). A fit's
 * warnings are passed once, when it is fitted (`lm`, `glm`, `aov`, `lmer`, ...): a function given a fit or a table
 * (`anova`, `aovSummary`, `Anova`, `glmSummary`, `etaSquared`, `lmerSummary`, ...) keeps them in its result's
 * `warnings` but passes only the warnings it adds. An error thrown by the handler propagates to the caller. By default
 * there is no handler and nothing is printed.
 *
 * To print the warnings as R does, set `(message, source) => console.warn(source + ": " + message)`. A handler that
 * throws (`(message) => { throw new Error(message); }`) turns each warning into an error, as R's `options(warn = 2)`.
 *
 * The handler is kept on `globalThis`, so it is one setting for every copy of the library loaded on a page.
 *
 * @param handler The function that receives the warnings, or `null` to stop passing them.
 * @returns The handler set before, or `null`.
 * @throws TypeError if `handler` is neither a function nor `null`.
 *
 * @example
 * ```ts
 * const seen: string[] = [];
 * const previous = setWarningHandler((message, source) => { seen.push(`${source}: ${message}`); });
 * optim([1, 1], (p) => (p[0] - 2) ** 2 + (p[1] - 3) ** 2, { lower: [0, 0] }).warnings;
 * // ["bounds can only be used with method L-BFGS-B (or Brent)"]
 * setWarningHandler(previous);
 * seen; // ["optim: bounds can only be used with method L-BFGS-B (or Brent)"]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function setWarningHandler(handler: WarningHandler | null): WarningHandler | null;
/**
 * Passes a call's warnings to the handler (each distinct one once, in order), unless the call is inside another
 * public function (`unreported`) or no handler is set. An error of the handler propagates.
 */
export declare function reportWarnings(source: string, warnings: readonly string[]): void;
/**
 * Passes the warnings of a result to the handler (reportWarnings) and returns the result. The warnings of `given` (the
 * fits or tables the function was given, whose warnings the result keeps) are left out: they were passed by the call
 * that made them.
 */
export declare function reported<T extends {
    readonly warnings?: readonly string[];
}>(source: string, result: T, ...given: readonly unknown[]): T;
/** Runs a call of a public function inside another one: its warnings are not passed to the handler */
export declare function unreported<T>(f: () => T): T;
/** Collects warnings in order of first appearance, each once (as the fixtures list R's warnings) */
export declare class Warnings {
    readonly list: string[];
    add(message: string): void;
}
/** Runs f with `sink` as the sink of `warn` */
export declare function withWarnings<T>(sink: Warnings, f: () => T): T;
/** Adds a warning to the sink set by withWarnings (none outside it) */
export declare function warn(message: string): void;
