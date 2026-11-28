// The options a formula fit was given (weights, offset, family, contrasts, levels, ...), for the refits of step,
// drop1, add1 and mediate's bootstrap. Kept beside the result, not in it, so that the result's shape does not change:
// a non-enumerable property under a registered symbol, so that a fit made by one bundle of rStats.js (dist/rstats.js)
// is recognised by another (dist/causal.js), and a copy of the result (spread, structuredClone, JSON) does not carry it.
//
// Written for rStats.js (no ported code).
const KEY = Symbol.for("rstats.js fit options");
/** Records the options of a fit (a shallow copy) and returns the fit */
export function setFitOptions(fit, options) {
    Object.defineProperty(fit, KEY, { value: Object.freeze({ ...options }), enumerable: false, configurable: true, writable: false });
    return fit;
}
/** The options a fit was given, if it came from lm or glm with a formula */
export function fitOptions(fit) {
    return fit[KEY];
}
