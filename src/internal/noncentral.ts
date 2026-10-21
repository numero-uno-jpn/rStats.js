// Options for noncentral distributions (dchisq / pchisq / qchisq, dt / pt / qt, df / pf / qf, dbeta / pbeta / qbeta).

/**
 * Noncentrality option accepted by the chi-squared, t, F and beta distribution functions.
 */
export interface NoncentralOption {
  /**
   * Noncentrality parameter. If omitted, the central distribution is used.
   * As in R, an explicit `ncp: 0` describes the same distribution as the central one. R then uses
   * the noncentral algorithm, so its values can differ slightly from the central values;
   * rStats.js returns values of the same accuracy in both cases.
   */
  ncp?: number;
}
