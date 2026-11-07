// Times that differ by rounding error only, merged as R's survival does by default (timefix = TRUE, aeqSurv): coxph and
// survfit / survdiff (survival.ts).
import { mean } from "../internal/summary.js";
/** Times within sqrt(eps) (absolutely or relative to the mean absolute distinct time) merged to the smaller one */
export function mergeTiedTimes(time) {
    const tol = Math.sqrt(2 ** -52);
    const distinct = Array.from(new Set(time.filter((t) => Number.isFinite(t)))).sort((a, b) => a - b);
    if (distinct.length < 2)
        return time.slice();
    // the mean of |time| without overflow (a plain sum of times near 1e308 was Infinity, so every relative gap was 0 and
    // distinct times were merged: coxph gave a coefficient of 0); a gap that overflows is Infinity, a distinct time
    const meanAbs = mean(distinct.map(Math.abs));
    const cuts = [distinct[0]];
    for (let k = 0; k + 1 < distinct.length; k++) {
        const gap = distinct[k + 1] - distinct[k];
        if (!(gap <= tol || gap / meanAbs <= tol))
            cuts.push(distinct[k + 1]);
    }
    return time.map((t) => {
        if (!Number.isFinite(t))
            return t;
        // the largest cut point not above t
        let lo = 0;
        let hi = cuts.length - 1;
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2); // not >> 1, which wraps beyond 2^31 times (issue #352)
            if (cuts[mid] <= t)
                lo = mid;
            else
                hi = mid - 1;
        }
        return cuts[lo];
    });
}
