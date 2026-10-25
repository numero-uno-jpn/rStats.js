// Shared pieces of the Monte Carlo p-values of chisqTest and fisherTest.
/** R's method suffix for a simulated p-value; B is printed as R's paste() prints a number */
export function simulatedMethod(B) {
    return ` with simulated p-value\n\t (based on ${formatR(B)} replicates)`;
}
/** A number as R's as.character prints it (15 significant digits, fixed or scientific, whichever is narrower) */
function formatR(v) {
    if (!Number.isFinite(v) || v === 0)
        return String(v);
    const sci = v.toExponential(14).replace(/\.?0+e/, "e");
    const [mant, exp] = sci.split("e");
    const e = Number(exp);
    const sciStr = `${mant}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
    const fixed = String(Number(v.toPrecision(15)));
    return fixed.length <= sciStr.length ? fixed : sciStr;
}
