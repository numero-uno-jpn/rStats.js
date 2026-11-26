// Time series analysis (rStats.js/timeseries).

export { acf, pacf, ccf, type AcfType, type AcfNaAction, type AcfOptions, type PacfOptions, type CcfOptions, type AcfResult } from "../timeseries/acf.js";
export { arima, predictArima, minRootModulus, type ArimaOptions, type ArimaSeasonal, type ArimaResult, type ArimaStateModel, type PredictArimaResult } from "../timeseries/arima.js";
export { boxCox, invBoxCox, boxCoxLambda, forecastArima, forecastFromArima, ndiffs, kpssStatistic, kpssPValue, type ForecastArimaOptions, type ForecastArimaResult, type ForecastResult } from "../timeseries/forecastArima.js";
export { stl, supsmu, mstl, seasadj, nsdiffs, ocsbTest, ocsbCritical, type StlOptions, type StlResult, type MstlResult } from "../timeseries/stl.js";
