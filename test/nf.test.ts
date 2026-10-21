import { df, pf, qf } from "../src/index.js";
import { bool, num } from "./helpers/fixture.js";
import { fixtureSuite } from "./helpers/suite.js";

// Noncentral F distribution (when ncp is given)
const opts = (a: Record<string, string | boolean>) => ({
  ncp: num(a.ncp),
  lowerTail: bool(a.lowerTail),
  logP: bool(a.logP),
});

fixtureSuite({
  name: "dnf",
  tolerance: 1e-14,
  density: true,
  // R's df(0, df1, Inf, ncp, log = TRUE) does not match the log of the log = FALSE value (ours does)
  knownDifference: (a, _e, x) => {
    if (!(a.log === true && num(a.x) === 0 && num(a.df2) === Infinity)) return undefined;
    const lin = df(0, num(a.df1), Infinity, { ncp: num(a.ncp) });
    return Math.abs(x - Math.log(lin)) <= 1e-15 * Math.max(1, Math.abs(x)) ? "R's log density at x = 0 with df2 = Inf" : undefined;
  },
  call: (a) => df(num(a.x), num(a.df1), num(a.df2), { ncp: num(a.ncp), log: bool(a.log) }),
});
fixtureSuite({
  name: "pnf",
  tolerance: 1e-14,
  call: (a) => pf(num(a.q), num(a.df1), num(a.df2), opts(a)),
});
// Rows with df2 = Inf are excluded from the suite's boundary checks (which cover only rows with all-finite parameters), so check them here
const infDf2 = (a: Record<string, string | boolean>, e: number, x: number): string | undefined => {
  if (num(a.df2) !== Infinity || !a.logP || !a.lowerTail) return undefined;
  const p = num(a.p);
  // We return 0: if the CDF at the smallest positive number already exceeds p, the answer is too small to represent
  if (x === 0 && e > 0 && pf(Number.MIN_VALUE, num(a.df1), Infinity, opts(a)) >= p) return "df2 = Inf: the answer rounds to 0";
  // R returns Inf: we pass if the CDF at our answer gives back p (R rounds log p = -1e-300 to 1)
  if (e === Infinity && Number.isFinite(x) && Math.abs(pf(x, num(a.df1), Infinity, opts(a)) - p) <= 1e-12 * Math.abs(p))
    return "df2 = Inf: R returns Inf (answer checked via the CDF)";
  return undefined;
};

fixtureSuite({
  name: "qnf",
  tolerance: 1e-14,
  knownDifference: infDf2,
  call: (a) => qf(num(a.p), num(a.df1), num(a.df2), opts(a)),
  backward: (a, x) => pf(x, num(a.df1), num(a.df2), opts(a)),
});
