// The number of input rows a fit was given (before the rows with a missing value were dropped), for the functions that
// take one value per input row of a fit (vcovCL's cluster). Kept beside the result, not in it.
const INPUT_ROWS = new WeakMap();
/** Records the number of input rows of a fit and returns the fit */
export function setInputRowCount(fit, n) {
    if (n !== undefined)
        INPUT_ROWS.set(fit, n);
    return fit;
}
/**
 * The number of input rows of a fit: as recorded, or else one more than the last row used (a fit copied from the
 * result, whose trailing rows dropped for a missing value cannot be known)
 */
export function inputRowCount(fit, rows) {
    return INPUT_ROWS.get(fit) ?? (rows.length === 0 ? 0 : rows[rows.length - 1] + 1);
}
/** The number of rows of a data frame: the length of a column of the formula's variables, else of its first column */
export function dataRowCount(data, variables) {
    for (const v of variables)
        if (Object.hasOwn(data, v))
            return data[v].length;
    return Object.values(data)[0]?.length;
}
