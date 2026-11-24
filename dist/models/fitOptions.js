// The options a formula fit was given (weights, offset, family, contrasts, levels, ...), for the refits of step,
// drop1 and add1. Kept beside the result, not in it, so that the result's shape does not change.
//
// Written for rStats.js (no ported code).
const FIT_OPTIONS = new WeakMap();
/** Records the options of a fit (a shallow copy) and returns the fit */
export function setFitOptions(fit, options) {
    FIT_OPTIONS.set(fit, { ...options });
    return fit;
}
/** The options a fit was given, if it came from lm or glm with a formula */
export function fitOptions(fit) {
    return FIT_OPTIONS.get(fit);
}
