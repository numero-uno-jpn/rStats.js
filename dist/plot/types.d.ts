/**
 * One row of a plot layer: numbers (NaN for a missing value) and strings.
 *
 * @category Plot data
 */
export type PlotRow = Record<string, number | string | boolean>;
/**
 * Axis labels and other facts about a figure, for titles and legends.
 *
 * @category Plot data
 */
export interface PlotMeta {
    /** A suggested title. */
    title?: string;
    /** A suggested label of the x axis. */
    xLabel?: string;
    /** A suggested label of the y axis. */
    yLabel?: string;
    /** Numbers to show with the figure (an AUC, a heterogeneity statistic). */
    [key: string]: unknown;
}
/**
 * The data of a figure: named layers of rows (each layer one kind of mark: a line, points, a band) and
 * {@link PlotMeta}. The plot-data functions return this shape with their own row types.
 *
 * @category Plot data
 */
export interface PlotData<L extends Record<string, readonly object[]> = Record<string, PlotRow[]>> {
    /** The layers, each an array of rows. */
    layers: L;
    /** Labels and summary numbers. */
    meta: PlotMeta;
}
/** z_{(1 + level) / 2}, checking the level */
export declare function levelCheck(level: number): number;
