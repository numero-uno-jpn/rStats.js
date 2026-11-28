/** Records the options of a fit (a shallow copy) and returns the fit */
export declare function setFitOptions<T extends object>(fit: T, options: object): T;
/** The options a fit was given, if it came from lm or glm with a formula */
export declare function fitOptions(fit: object): Readonly<Record<string, unknown>> | undefined;
