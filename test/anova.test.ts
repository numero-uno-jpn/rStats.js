// aov (one way), TukeyHSD and zTest against R (oracle/anova.R; BSDA::z.test)
import { aov, TukeyHSD, zTest } from "../src/index.js";
import type { Alternative } from "../src/index.js";
import { num } from "./helpers/fixture.js";
import { arg, defined, htestSuite, type HTestArg } from "./helpers/htest.js";

type A = Record<string, HTestArg>;
const groups = (a: A): number[][] => (a.groups as unknown as (string | string[])[]).map((g) => (Array.isArray(g) ? g : [g]).map(num));
/** Group labels of the (y, g) form: numbers when they all parse as numbers (R's numeric factor), strings otherwise */
const labels = (a: A): (number | string)[] => {
  const g = a.g as string[];
  return g.every((v) => !Number.isNaN(Number(v))) ? g.map(num) : g;
};

/**
 * R fits aov through a QR decomposition of the model matrix, which loses digits on data with a large mean and a
 * small spread (1e6 + 1e-3 noise: sums of squares off by 6e-8; the values here agree with 50-digit ones) and leaves
 * rounding residue when all values are equal (F = 1 from 1e-30 / 1e-30; here 0 / 0 = NaN)
 */
function qrRounding(a: A): string | undefined {
  const all = a.groups === undefined ? arg.vec(a.y)!.filter((v) => !Number.isNaN(v)) : groups(a).flat();
  const m = all.reduce((s, v) => s + v, 0) / all.length;
  const sd = Math.sqrt(all.reduce((s, v) => s + (v - m) ** 2, 0) / (all.length - 1));
  if (sd === 0) return "all values equal: R's QR leaves rounding residue (F = 1), the exact F is 0/0";
  return sd / Math.abs(m) < 1e-6 ? "large mean and small spread: R's QR loses digits" : undefined;
}

htestSuite({
  name: "aovOneway",
  call: (a) => aov(groups(a)),
  tolerance: 1e-12,
  // within-group sums of squares that are 0 here are QR rounding residue in R (F = 5.9e30 instead of Inf)
  floor: { sumSq: 1e-10, meanSq: 1e-10 },
  knownDifference: (a, field, expected, actual) =>
    (field === "fValue" && actual === Infinity && expected > 1e25) || (field === "pValue" && actual === 0 && expected < 1e-25)
      ? "a residual sum of squares of exactly 0 is rounding residue in R"
      : qrRounding(a),
});

htestSuite({
  name: "TukeyHSD",
  call: (a) =>
    a.groups === undefined
      ? TukeyHSD(arg.vec(a.y)!, labels(a), defined({ confLevel: arg.num(a.confLevel) }))
      : TukeyHSD(groups(a), defined({ confLevel: arg.num(a.confLevel) })),
  tolerance: 1e-12,
  // R's ptukey is accurate to about 8 digits and qtukey to about 4 (docs/differences-from-r.md); the values here
  // agree with high-precision references in test/tukey.test.ts
  knownDifference: (a, field, expected, actual) => {
    const qr = qrRounding(a);
    if (qr !== undefined) return qr;
    const rel = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300);
    // (to 3e-6 at df = 5: for two groups the exact value follows from the t distribution, and agrees with ours)
    if (field === "pAdj" && (rel <= 1e-5 || Math.abs(actual - expected) <= 1e-9)) return "R's ptukey is accurate to about 8 digits";
    if ((field === "lwr" || field === "upr") && rel <= 1e-3) return "R's qtukey is accurate to about 4 digits";
    return undefined;
  },
});

htestSuite({
  name: "zTest",
  call: (a) =>
    zTest(
      arg.vec(a.x)!,
      arg.vec(a.y),
      defined({
        sigmaX: arg.num(a.sigmaX),
        sigmaY: arg.num(a.sigmaY),
        mu: arg.num(a.mu),
        alternative: arg.str<Alternative>(a.alternative),
        confLevel: arg.num(a.confLevel),
      }),
    ),
  tolerance: 1e-12,
  floor: { confInt: 1 },
  knownDifference: (_a, field, expected, actual) => {
    if (field === "confInt" && Number.isNaN(expected) && !Number.isFinite(actual)) return "BSDA reports NA for the open end of a one-sided interval";
    if (field === "pValue" && Math.abs(actual - expected) <= 1e-15) return "BSDA forms the upper tail as 1 - pnorm(z)";
    return undefined;
  },
});
