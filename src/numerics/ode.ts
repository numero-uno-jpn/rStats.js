// Fixed-step solvers of ordinary differential equations: deSolve's ode with method "euler" or "rk4", and its
// rkMethod("rk2") (deSolve's ode() itself does not accept method = "rk2").
//
// Written for rStats.js from the textbook formulas (no ported code). The step is the spacing of `times` (one step
// per interval), as in deSolve's fixed-step methods. rk2 is Heun's method (deSolve's rkMethod("rk2")): the slopes at
// the start and at the Euler predictor, averaged; rk4 is the classical fourth-order Runge-Kutta method.

/** Derivative of the state: `func(t, y, parms)` returns dy/dt (one value per state variable). */
export type OdeFunc = (t: number, y: number[], parms: number[]) => readonly number[];

/** Options for {@link ode}. */
export interface OdeOptions {
  /** `"euler"`, `"rk2"` (Heun) or `"rk4"` (classical Runge-Kutta, default). */
  method?: "euler" | "rk2" | "rk4";
}

/**
 * Solve the initial value problem y' = func(t, y, parms), y(times[0]) = y, with one fixed step per interval of
 * `times`. Equivalent to `deSolve::ode(y, times, func, parms, method)` in R. That is for `"euler"` and `"rk4"`; for
 * `"rk2"`, it is `deSolve::ode(..., method = rkMethod("rk2"))` (or `deSolve::rk(..., method = "rk2")`), since deSolve's `ode()`
 * does not accept `method = "rk2"`.
 *
 * @returns One row per time: `[t, y1, y2, ...]`.
 *
 * @example
 * ```ts
 * // exponential decay y' = -0.7 y
 * const out = ode([1], [0, 0.5, 1], (t, y, p) => [-p[0]! * y[0]!], [0.7], { method: "rk4" });
 * out[2]; // [1, 0.49664] (exp(-0.7) = 0.49659)
 * ```
 */
export function ode(y: readonly number[], times: readonly number[], func: OdeFunc, parms: readonly number[] = [], options: OdeOptions = {}): number[][] {
  const method = options.method ?? "rk4";
  if (method !== "euler" && method !== "rk2" && method !== "rk4") throw new RangeError(`unknown method '${String(method)}'`);
  const p = [...parms];
  const n = y.length;
  const deriv = (t: number, s: number[]): number[] => {
    const d = Array.from(func(t, s, p));
    if (d.length !== n) throw new RangeError(`The number of derivatives returned by func() (${d.length}) must equal the length of the initial conditions vector (${n})`);
    return d;
  };
  const axpy = (s: number[], h: number, k: number[]): number[] => s.map((v, i) => v + h * k[i]!);
  let state = [...y];
  const out: number[][] = [];
  if (times.length === 0) return out;
  out.push([times[0]!, ...state]);
  for (let j = 1; j < times.length; j++) {
    const t = times[j - 1]!;
    const h = times[j]! - t;
    const k1 = deriv(t, state);
    if (method === "euler") state = axpy(state, h, k1);
    else if (method === "rk2") {
      const k2 = deriv(t + h, axpy(state, h, k1));
      state = state.map((v, i) => v + h * (0.5 * k1[i]! + 0.5 * k2[i]!));
    } else {
      const k2 = deriv(t + h / 2, axpy(state, h / 2, k1));
      const k3 = deriv(t + h / 2, axpy(state, h / 2, k2));
      const k4 = deriv(t + h, axpy(state, h, k3));
      state = state.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
    }
    out.push([times[j]!, ...state]);
  }
  return out;
}
