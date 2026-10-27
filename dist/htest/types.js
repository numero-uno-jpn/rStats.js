// Test results (plain objects corresponding to R's htest).
//
// R's named values (statistic, parameter, estimate, null.value) are split into separate number and name
// fields. Only an estimate with two values (e.g. the means of two samples) is an array.
/** Like R's match.arg, abbreviations ("two", "l", "g") are also accepted */
export function matchAlternative(a) {
    if (a === undefined)
        return "two.sided";
    const all = ["two.sided", "less", "greater"];
    const hit = all.filter((v) => v.startsWith(a));
    if (a.length === 0 || hit.length !== 1)
        throw new RangeError(`invalid alternative "${a}" (expected "two.sided", "less" or "greater")`);
    return hit[0];
}
/** Validate the confidence level (R's t.test also accepts exactly 0 and 1; with 1 the interval is ±Inf) */
export function checkConfLevel(level) {
    if (!(Number.isFinite(level) && level >= 0 && level <= 1)) {
        throw new RangeError("confLevel must be a number between 0 and 1");
    }
}
/** Validate the confidence level strictly inside (0, 1), as most of R's tests require */
export function checkConfLevelOpen(level) {
    if (!(Number.isFinite(level) && level > 0 && level < 1)) {
        throw new RangeError("'conf.level' must be a single number between 0 and 1");
    }
}
