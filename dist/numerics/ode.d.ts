/** Derivative of the state: `func(t, y, parms)` returns dy/dt (one value per state variable). */
export type OdeFunc = (t: number, y: number[], parms: number[]) => readonly number[];
/** Options for {@link ode}. */
export interface OdeOptions {
    /** `"euler"`, `"rk2"` (Heun) or `"rk4"` (classical Runge-Kutta, default). */
    method?: "euler" | "rk2" | "rk4";
}
/**
 * Solve the initial value problem y' = func(t, y, parms), y(times[0]) = y, with one fixed step per interval of
 * `times`. Equivalent to `deSolve::ode(y, times, func, parms, method)` for `"euler"` and `"rk4"`; for `"rk2"`, to
 * `deSolve::ode(..., method = rkMethod("rk2"))` (or `deSolve::rk(..., method = "rk2")`), since deSolve's `ode()`
 * does not accept `method = "rk2"`.
 *
 * @returns One row per time: `[t, y1, y2, ...]`.
 *
 * @example
 * ```ts
 * // exponential decay y' = -0.7 y
 * const out = ode([1], [0, 0.5, 1], (t, y, p) => [-p[0]! * y[0]!], [0.7], { method: "rk4" });
 * out[2]; // [1, 0.4965...]
 * ```
 */
export declare function ode(y: readonly number[], times: readonly number[], func: OdeFunc, parms?: readonly number[], options?: OdeOptions): number[][];
