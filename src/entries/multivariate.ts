// Multivariate analysis (rStats.js/multivariate).

export { manova, manovaSummary, type ManovaFit, type ManovaOptions, type ManovaSummary, type ManovaSummaryOptions, type ManovaTestName, type MatrixTable } from "../multivariate/manova.js";
export { cancor, type CancorOptions, type CancorResult } from "../multivariate/cancor.js";
export { lda, ldaPredict, type LdaOptions, type LdaPredictionOptions, type LdaFit, type LdaPrediction, type LdaCVResult, type LdaTable } from "../multivariate/lda.js";
export { dist, asDist, type DistMethod, type DistResult, type DistOptions, type AsDistOptions } from "../multivariate/dist.js";
export { hclust, cutree, type HclustMethod, type HclustFit, type HclustOptions, type CutreeOptions, type CutreeResult } from "../multivariate/hclust.js";
export { kmeans, type KmeansFit, type KmeansOptions, type KmeansTable, type KmeansInputTable } from "../multivariate/kmeans.js";
export { cmdscale, type CmdscaleOptions, type CmdscaleResult, type CmdscaleInputTable } from "../multivariate/cmdscale.js";

export { ca, caSummary, caCoord, type CaFit, type CaOptions, type CaInputTable, type CaSummary, type CaCoordOptions, type CaMatrix, type CaCoordMaps } from "../multivariate/ca.js";
export { mjca, type MjcaFit, type MjcaInputTable, type MjcaOptions, type MjcaMatrix, type MjcaLevelsN } from "../multivariate/mjca.js";
export { sammon, type SammonOptions, type SammonMatrix, type SammonInputTable, type SammonTrace, type SammonResult } from "../multivariate/sammon.js";
export { isoMDS, type IsoMDSOptions, type IsoMDSResult, type IsoMDSTrace, type IsoMDSMatrix } from "../multivariate/isoMDS.js";
