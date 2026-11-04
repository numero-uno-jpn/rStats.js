// R's warnings: the collection of a call's warnings (each once, in order) and the handler that receives them when a
// public function returns (setWarningHandler).
//
// Every function that returns warnings in its result passes them to the handler at its end: `return reported("glm",
// result)` (or `reportWarnings("pivotLonger", warnings)` where the result has no `warnings`). A public function that
// calls another one that reports (pairwiseWilcoxTest calling wilcoxTest, aovEz calling lm) makes that call through
// `unreported`, so that only the outer call passes its warnings, which include the inner ones it keeps. Nothing runs
// at the top level (package.json has sideEffects: false).

/**
 * A function that receives R's warnings: the warning's text and the name of the function that gave it, once per
 * distinct warning of a call, after the call has computed its result.
 *
 * @category Hypothesis tests
 */
export type WarningHandler = (message: string, source: string) => void;

/** The key of the handler on globalThis, shared by every copy of the library on a page */
const HANDLER_KEY = "@numero-uno-jpn/rstats.warningHandler";

type HandlerHolder = { [key: symbol]: WarningHandler | null | undefined };

/** The handler set by setWarningHandler (null when none) */
function currentHandler(): WarningHandler | null {
  return (globalThis as unknown as HandlerHolder)[Symbol.for(HANDLER_KEY)] ?? null;
}

/**
 * Sets the function that receives R's warnings, and returns the one it replaces (`null` when there was none). Not an
 * R function. It plays the part of R's printing of warnings (and, by throwing, of `options(warn = 2)`).
 *
 * Every test, model and fit returns R's warnings in its result's `warnings` whatever the handler. With a handler
 * set, each call of such a function (and `pivotLonger` without `onWarning`) also passes its warnings to the handler
 * once it has computed its result: each distinct warning once, in order, with the name of the function called (a
 * function that calls another, such as `pairwiseWilcoxTest`, passes the warnings once, under its own name). An error
 * thrown by the handler propagates to the caller. By default there is no handler and nothing is printed.
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
export function setWarningHandler(handler: WarningHandler | null): WarningHandler | null {
  if (handler !== null && typeof handler !== "function") throw new TypeError("handler must be a function or null");
  const previous = currentHandler();
  (globalThis as unknown as HandlerHolder)[Symbol.for(HANDLER_KEY)] = handler;
  return previous;
}

/** How many calls of public functions through `unreported` are running: their warnings go to the outer call only */
let depth = 0;

/**
 * Passes a call's warnings to the handler (each distinct one once, in order), unless the call is inside another
 * public function (`unreported`) or no handler is set. An error of the handler propagates.
 */
export function reportWarnings(source: string, warnings: readonly string[]): void {
  if (depth > 0 || warnings.length === 0) return;
  const handler = currentHandler();
  if (handler === null) return;
  for (const message of new Set(warnings)) handler(message, source);
}

/** Passes the warnings of a result to the handler (reportWarnings) and returns the result */
export function reported<T extends { readonly warnings?: readonly string[] }>(source: string, result: T): T {
  reportWarnings(source, result.warnings ?? []);
  return result;
}

/** Runs a call of a public function inside another one: its warnings are not passed to the handler */
export function unreported<T>(f: () => T): T {
  depth++;
  try {
    return f();
  } finally {
    depth--;
  }
}

/** Collects warnings in order of first appearance, each once (as the fixtures list R's warnings) */
export class Warnings {
  readonly list: string[] = [];
  add(message: string): void {
    if (!this.list.includes(message)) this.list.push(message);
  }
}

/** The warnings sink of the link functions that warn ("NaNs produced"); set while a fit runs */
let currentWarnings: Warnings | undefined;

/** Runs f with `sink` as the sink of `warn` */
export function withWarnings<T>(sink: Warnings, f: () => T): T {
  const saved = currentWarnings;
  currentWarnings = sink;
  try {
    return f();
  } finally {
    currentWarnings = saved;
  }
}

/** Adds a warning to the sink set by withWarnings (none outside it) */
export function warn(message: string): void {
  currentWarnings?.add(message);
}
