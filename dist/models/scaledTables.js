// Tables of sums of squares in the units of the response as fitted (divided by 2^k, so that 2^2k scales the tables
// that the functions return), kept by result object for the effect sizes: those are ratios of sums of squares, which
// the returned tables can no longer give where their sums of squares overflow (data around 1e154). Written for
// rStats.js.
/** The scaled table of anova(), aovSummary() and aovEz() results; the scaled strata of aov() with Error() and its summary */
export const scaledTables = new WeakMap();
