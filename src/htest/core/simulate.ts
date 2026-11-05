// Shared pieces of the Monte Carlo p-values of chisqTest and fisherTest.

/** R's method suffix for a simulated p-value; B is printed as R's paste() prints a number */
export function simulatedMethod(B: number): string {
  return ` with simulated p-value\n\t (based on ${formatR(B)} replicates)`;
}

/** A number as R's as.character prints it (15 significant digits, fixed or scientific, whichever is narrower) */
export function formatR(v: number): string {
  if (!Number.isFinite(v) || v === 0) return String(v);
  const sci = v.toExponential(14).replace(/\.?0+e/, "e");
  const [mant, exp] = sci.split("e") as [string, string];
  const e = Number(exp);
  const sciStr = `${mant}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
  const fixed = String(Number(v.toPrecision(15)));
  return fixed.length <= sciStr.length ? fixed : sciStr;
}

/**
 * A number as R's format() prints it with `digits` significant digits (default 7, R's option): the fewest significant
 * digits, at most `digits`, that show the number rounded to `digits`, in fixed notation unless the scientific one is
 * narrower (R's scipen = 0)
 */
export function formatDigits(v: number, digits = 7): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? "NaN" : v > 0 ? "Inf" : "-Inf";
  if (v === 0) return "0";
  const [mant, exp] = v.toExponential(digits - 1).split("e") as [string, string];
  const m = mant.includes(".") ? mant.replace(/0+$/, "").replace(/\.$/, "") : mant;
  const e = Number(exp);
  const sig = m.replace(/^-/, "").replace(".", "").length;
  const sciStr = `${m}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
  // digits right of the point in fixed notation
  const right = Math.max(0, sig - 1 - e);
  const fixedWidth = (v < 0 ? 1 : 0) + (e >= 0 ? e + 1 : 1) + (right > 0 ? right + 1 : 0);
  return fixedWidth > sciStr.length ? sciStr : v.toFixed(right);
}
