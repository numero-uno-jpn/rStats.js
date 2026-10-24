// integrate, optimize, uniroot, interpolation, ode and numerical derivatives against R (oracle/numerics.R; deSolve,
// numDeriv, pracma). The functions are given in the fixtures as JS expressions (args.js).
import {
  approx,
  barylag,
  grad,
  hermiteInterp,
  hessian,
  integrate,
  jacobian,
  ode,
  optimize,
  spline,
  splinefun,
  splinefunH,
  uniroot,
} from "../src/index.js";
import type { SplineMethod } from "../src/index.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

type A = Record<string, HTestArg>;
const fx = (a: A) => new Function("x", `return ${arg.str(a.js)}`) as (x: number) => number;
const fv = (a: A) => new Function("x", `return ${arg.str(a.js)}`) as (x: number[]) => number;

htestSuite({
  name: "integrate",
  call: (a) =>
    integrate(fx(a), arg.num(a.lower)!, arg.num(a.upper)!, defined({
      subdivisions: arg.num(a.subdivisions),
      relTol: arg.num(a.relTol),
      stopOnError: arg.bool(a.stopOnError),
    })),
  tolerance: 1e-14,
  // the error estimate is made from differences of rounding-level quantities, so last-bit differences of exp, cos
  // and pow between JS and the C library move it by up to a few percent, and the value within that estimate
  knownDifference: (a, field, expected, actual) => {
    if (field === "absError" && Math.abs(actual - expected) <= 0.1 * expected) return "error estimate moved by rounding";
    if (field === "value") {
      const est = integrate(fx(a), arg.num(a.lower)!, arg.num(a.upper)!, { stopOnError: false }).absError;
      if (Math.abs(actual - expected) <= est) return "value within the error estimate";
    }
    return undefined;
  },
});

htestSuite({
  name: "optimize",
  call: (a) => optimize(fx(a), arg.num(a.lower)!, arg.num(a.upper)!, defined({ maximum: arg.bool(a.maximum), tol: arg.num(a.tol) })),
  tolerance: 1e-14,
  // at a flat optimum, last-bit differences of exp between JS and the C library move the point found (by 4e-14)
  knownDifference: (_, field, expected, actual) =>
    field === "optimum" && Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)) ? "flat optimum: f rounding moves the point" : undefined,
});

htestSuite({
  name: "uniroot",
  call: (a) =>
    uniroot(fx(a), arg.num(a.lower)!, arg.num(a.upper)!, defined({
      tol: arg.num(a.tol),
      maxiter: arg.num(a.maxiter),
      extendInt: arg.str<"no" | "yes" | "downX" | "upX">(a.extendInt),
    })),
  tolerance: 1e-14,
  // f at the root is rounding-level (cos and atan of JS and the C library differ in the last bit): absolute error
  floor: { fRoot: 1 },
});

htestSuite({
  name: "approx",
  call: (a) =>
    approx(arg.vec(a.x)!, arg.vec(a.y)!, defined({
      xout: arg.vec(a.xout),
      method: arg.str<"linear" | "constant">(a.method),
      n: arg.num(a.n),
      yleft: arg.num(a.yleft),
      yright: arg.num(a.yright),
      rule: a.rule === undefined ? undefined : (arg.vec(a.rule)!.length === 1 ? arg.vec(a.rule)![0]! : (arg.vec(a.rule) as [number, number])),
      f: arg.num(a.f),
      ties: arg.str<"mean" | "min" | "max">(a.ties),
    })),
  tolerance: 1e-15,
});

htestSuite({
  name: "spline",
  call: (a) =>
    spline(arg.vec(a.x)!, arg.vec(a.y)!, defined({
      n: arg.num(a.n),
      method: arg.str<SplineMethod>(a.method),
      xout: arg.vec(a.xout),
      xmin: arg.num(a.xmin),
      xmax: arg.num(a.xmax),
    })),
  tolerance: 1e-13,
});

/**
 * Third derivative of the cubic Hermite spline with values y and slopes m at x (sorted), at each query: on
 * [x_i, x_{i+1}] (the interval of the last knot <= u) the constant (6 m_i + 6 m_{i+1} - 12 delta) / h^2, with
 * h = x_{i+1} - x_i and delta = (y_{i+1} - y_i) / h; 0 outside the data. `h` is that interval's length (1 outside).
 */
function hermiteThird(x: number[], y: number[], m: number[], xq: number[]): { exact: number; h: number }[] {
  return xq.map((u) => {
    const i = x.filter((v) => v <= u).length - 1;
    if (i < 0 || i >= x.length - 1) return { exact: 0, h: 1 };
    const h = x[i + 1]! - x[i]!;
    const delta = (y[i + 1]! - y[i]!) / h;
    return { exact: (6 * m[i]! + 6 * m[i + 1]! - 12 * delta) / (h * h), h };
  });
}

/**
 * R's third derivative of a cubic Hermite spline (splinefunH, splinefun "monoH.FC") is divided by h once instead of
 * h^2; rStats.js returns the exact value. Such a value is accepted when it is the closed form above at some query
 * where R's value is h times the closed form.
 */
const hermiteThirdDifference =
  (slopes: (a: A) => number[] | undefined) =>
  (a: A, _field: string, expected: number, actual: number): string | undefined => {
    const m = slopes(a);
    if (m === undefined || Math.trunc(arg.num(a.deriv)!) !== 3) return undefined;
    const close = (u: number, v: number) => Math.abs(u - v) <= 1e-13 * Math.max(Math.abs(v), 1e-1);
    const ok = hermiteThird(arg.vec(a.x)!, arg.vec(a.y)!, m, arg.vec(a.xq)!).some(
      ({ exact, h }) => close(actual, exact) && close(expected, exact * h),
    );
    return ok ? "third derivative of a Hermite spline: exact value, where R divides by h instead of h^2" : undefined;
  };

htestSuite({
  name: "splinefun",
  call: (a) => ({
    value: splinefun(arg.vec(a.x)!, arg.vec(a.y)!, defined({ method: arg.str<SplineMethod | "monoH.FC">(a.method) }))(arg.vec(a.xq)!, arg.num(a.deriv)),
  }),
  tolerance: 1e-13,
  floor: { value: 1e-14 },
  // monoH.FC: the closed form from R's own slopes (its first derivative at the knots, args.slopes)
  knownDifference: hermiteThirdDifference((a) => (a.method === "monoH.FC" ? arg.vec(a.slopes) : undefined)),
});

htestSuite({
  name: "splinefunH",
  call: (a) => ({ value: splinefunH(arg.vec(a.x)!, arg.vec(a.y)!, arg.vec(a.m)!)(arg.vec(a.xq)!, arg.num(a.deriv)) }),
  tolerance: 1e-13,
  floor: { value: 1e-14 },
  knownDifference: hermiteThirdDifference((a) => arg.vec(a.m)),
});

htestSuite({
  name: "barylag",
  call: (a) => ({ value: barylag(arg.vec(a.xi)!, arg.vec(a.yi)!, arg.vec(a.x)!) }),
  tolerance: 1e-14,
  // data of order 1 whose interpolant is 0 at a node (2.7e-17 in R): absolute error
  floor: { value: 1 },
});

htestSuite({
  name: "hermite",
  call: (a) => ({ value: hermiteInterp(arg.vec(a.xi)!, arg.vec(a.yi)!, arg.vec(a.di)!, arg.vec(a.x)!) }),
  tolerance: 1e-14,
});

htestSuite({
  name: "ode",
  call: (a) => {
    const f = new Function("t", "y", "p", `return ${arg.str(a.js)}`) as (t: number, y: number[], p: number[]) => number[];
    return { value: ode(arg.vec(a.y)!, arg.vec(a.times)!, f, arg.vec(a.parms) ?? [], { method: arg.str<"euler" | "rk2" | "rk4">(a.method)! }) };
  },
  tolerance: 1e-14,
  // states of order 1 crossing 0 (the harmonic oscillator): absolute error
  floor: { value: 1 },
});

/** Functions evaluated exactly alike in R and JS (arithmetic only): the derivatives agree to the last bits */
const EXACT = new Set(["rosenbrock"]);

/**
 * numDeriv's complex-step method needs a function of a complex argument; Richardson stands in for it. Elsewhere the
 * function values themselves differ from R's in the last bit (R's sum accumulates in long double; exp, log, sin and
 * cos come from different libraries), and a difference quotient magnifies that by |f| / h (h down to 1e-5 here, and
 * h^2 for the Hessian)
 */
const derivDifference = (a: A, _field: string, expected: number, actual: number): string | undefined => {
  const near = Math.abs(actual - expected) <= 1e-9 * Math.max(Math.abs(expected), 1e-1);
  if (a.method === "complex") return near ? "numDeriv's complex-step method is not offered (Richardson used instead)" : undefined;
  return near && !EXACT.has(arg.str(a.fn)!) ? "function values differ from R's in the last bit (magnified by the difference quotient)" : undefined;
};

htestSuite({
  name: "grad",
  call: (a) => ({ value: grad(fv(a), arg.vec(a.x)!, { method: a.method === "simple" ? "simple" : "Richardson" }) }),
  tolerance: 1e-14,
  floor: { value: 1e-12 },
  knownDifference: derivDifference,
});

htestSuite({
  name: "jacobian",
  call: (a) => ({
    value: jacobian(new Function("x", `return ${arg.str(a.js)}`) as (x: number[]) => number[], arg.vec(a.x)!, {
      method: a.method === "simple" ? "simple" : "Richardson",
    }),
  }),
  tolerance: 1e-14,
  floor: { value: 1e-12 },
  knownDifference: derivDifference,
});

htestSuite({
  name: "hessian",
  call: (a) => ({ value: hessian(fv(a), arg.vec(a.x)!) }),
  tolerance: 1e-14,
  floor: { value: 1e-12 },
  knownDifference: derivDifference,
});
