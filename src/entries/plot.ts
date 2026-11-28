// Plot data (rStats.js/plot, from 1.21.0): the values R's plots draw, as arrays of rows for any JavaScript plotting
// library (Observable Plot, Vega-Lite and ECharts take rows; fromRows in /descriptive turns them into columns for
// Plotly). Not in dist/rstats.js, as the other areas from 1.7.0 on.

export type { PlotRow, PlotMeta, PlotData } from "../plot/types.js";
export {
  survPlotData, cumincPlotData, rocPlotData, type SurvPlotDataOptions, type SurvStepRow,
} from "../plot/survival.js";
export {
  forestPlotData, funnelPlotData, netgraphData, type ForestPlotDataOptions, type FunnelPlotDataOptions,
  type NetgraphInput,
} from "../plot/meta.js";
export { qqPlotData, densityPlotData, boxplotData, ecdfPlotData, histPlotData } from "../plot/distribution.js";
export {
  lmDiagnosticsData, coefPlotData, predictionBandData, acfPlotData, forecastPlotData, type LmDiagnosticsDataOptions,
  type ForecastPlotDataOptions,
} from "../plot/models.js";
export { dendrogramData, biplotData, type DendrogramDataOptions, type BiplotDataOptions } from "../plot/multivariate.js";
