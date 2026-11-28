// The shape shared by the plot-data functions (src/plot/*.ts, 1.21.0): the layers of a figure as arrays of row
// objects, the form Observable Plot, Vega-Lite and ECharts take directly; fromRows turns a layer into columns for
// Plotly. Written for rStats.js (not an R structure: R's plotting functions draw instead of returning their values).
/** z_{(1 + level) / 2}, checking the level */
export function levelCheck(level) {
    if (!(level > 0 && level < 1))
        throw new RangeError("'level' must be between 0 and 1");
    return level;
}
