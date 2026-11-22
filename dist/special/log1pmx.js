// Ported from xsf include/xsf/cephes/unity.h (log1pmx) (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
import { MACHEP } from "./constants.js";
/** log(1 + x) - x. Uses a series for small |x| to avoid cancellation */
export function log1pmx(x) {
    if (Math.abs(x) < 0.5) {
        // (added for rStats.js) x^2 = 0, x = 0 included: every term is 0 and the series gave +0 only after its 498 steps,
        // as the test |term| < eps |res| is then 0 < 0 (issue #106)
        if (x * x === 0)
            return 0;
        let xfac = x;
        let res = 0;
        for (let n = 2; n < 500; n++) {
            xfac *= -x;
            const term = xfac / n;
            res += term;
            if (Math.abs(term) < MACHEP * Math.abs(res))
                break;
        }
        return res;
    }
    return Math.log1p(x) - x;
}
