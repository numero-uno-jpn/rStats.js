/**
 * Option shared by functions whose edge cases R defines differently from the mathematical function
 *
 * @category Special functions
 */
export interface RCompatibleOptions {
    /**
     * `true` (default) returns what R returns at the edge cases listed for each function; `false` returns the
     * mathematical value there instead (see docs/differences-from-r.md).
     */
    rCompatible?: boolean;
}
