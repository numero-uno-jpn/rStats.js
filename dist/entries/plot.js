// Plot data (rStats.js/plot, from 1.21.0): the values R's plots draw, as arrays of rows for any JavaScript plotting
// library (Observable Plot, Vega-Lite and ECharts take rows; fromRows in /descriptive turns them into columns for
// Plotly). Not in dist/rstats.js, as the other areas from 1.7.0 on.
export { survPlotData, cumincPlotData, rocPlotData, } from "../plot/survival.js";
export { forestPlotData, funnelPlotData, netgraphData, } from "../plot/meta.js";
export { qqPlotData, densityPlotData, boxplotData, ecdfPlotData, histPlotData } from "../plot/distribution.js";
export { lmDiagnosticsData, coefPlotData, predictionBandData, acfPlotData, forecastPlotData, } from "../plot/models.js";
export { dendrogramData, biplotData } from "../plot/multivariate.js";
