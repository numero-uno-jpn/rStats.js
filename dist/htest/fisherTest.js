// Fisher's exact test (R's fisher.test).
//
// 2x2 tables: with the margins fixed, the (1, 1) cell follows a noncentral hypergeometric distribution
// (noncentrality = odds ratio; Fisher 1935). The conditional MLE is the noncentrality whose mean equals the
// cell value; the confidence limits are the noncentralities at which a one-sided probability equals α. This construction
// is the same as scipy.stats.contingency.odds_ratio (scipy/stats/_odds_ratio.py; SciPy commit a087e61,
// BSD-3-Clause, see THIRD_PARTY_NOTICES.md). The root finding and defaults follow observed R output.
// - Roots are found with uniroot (Brent, tolerance eps^0.25): if the noncentrality ψ is below 1, search
//   ψ ∈ [0, 1]; if above 1, search 1/ψ ∈ [ε, 1] (R's estimate and interval endpoints are 1e-6 to 1e-2 away
//   from the true roots, but this procedure reproduces them to the last few digits)
// - The two-sided p-value is the sum of probabilities of tables whose probability is at most (1 + 1e-7) times the observed one
// - Counts are made integer by rounding half to even (R rounds with a warning)
//
// rxc tables: the probabilities of tables with fixed margins (multivariate hypergeometric) are
// traversed via a network that fixes one column at a time (Mehta & Patel 1983, JASA 78, 427-434),
// summing the probabilities of tables whose probability is at most (1 + 1e-7) times the observed
// one. A node is "the multiset of remaining row sums (sorted)". For each node the maximum and
// minimum probability of the remaining subtable are precomputed: if everything beyond a path is at
// or below the threshold, the remaining mass (a sum of conditional probabilities, hence 1) is added
// at once; if everything exceeds it, the path is dropped. Paths reaching the same node with the
// same probability are merged. For nodes with two columns left, a cumulative sum over the sorted
// values of the remaining tables is prepared and each path is added via binary search.
// Probabilities are held as double-double logarithms.
// R's hybrid and simulate.p.value are not implemented.
import { dhyper1, phyper1 } from "../distributions/hypergeometric.js";
import { roundHalfEven } from "../internal/integer.js";
import { uniroot } from "../internal/uniroot.js";
import { ddAdd, ddLog, ddNeg, ddSub } from "../special/dd.js";
import { matchAlternative } from "./types.js";
/** Relative tolerance for treating a table as "equally probable as the observed table" in the two-sided p-value */
const REL_ERR = 1 + 1e-7;
/**
 * Fisher's exact test for count data. Equivalent to R's `fisher.test()`.
 *
 * Tests independence in an r x c contingency table with fixed margins. For 2 x 2 tables
 * it also returns the conditional MLE of the odds ratio and its confidence interval,
 * reproducing R's numbers (including R's root-finding tolerance). The two-sided p-value
 * sums the probabilities of tables no more likely than the observed one (relative
 * tolerance `1e-7`, as in R). Non-integer counts are rounded to the nearest integer
 * (ties to even), where R warns and rounds.
 *
 * Not implemented: R's `hybrid` and `simulate.p.value` options.
 *
 * @param x Contingency table as an array of rows (at least 2 x 2).
 * @param options See {@link FisherTestOptions}.
 * @returns The test result; see {@link FisherTestResult}.
 *
 * @example
 * ```ts
 * const r = fisherTest([[3, 1], [1, 3]]);
 * r.pValue;   // 0.4857142857142857
 * r.estimate; // 6.408308867005792 (conditional MLE of the odds ratio)
 * r.confInt;  // [0.2117329153055031, 621.9337505454175]
 * ```
 */
export function fisherTest(x, options = {}) {
    const nr = x.length;
    const nc = nr === 0 ? 0 : x[0].length;
    if (x.some((r) => r.length !== nc))
        throw new TypeError("all rows of the matrix must have the same length");
    if (nr < 2 || nc < 2)
        throw new TypeError("'x' must have at least 2 rows and columns");
    const raw = x.map((r) => Array.from(r));
    if (raw.flat().some((v) => Number.isNaN(v) || v < 0)) {
        throw new RangeError("all entries of 'x' must be non-negative and finite");
    }
    if (raw.flat().some((v) => v === Infinity))
        throw new RangeError("'x' has entries too large to be integer");
    const t = raw.map((r) => r.map(roundHalfEven));
    const method = "Fisher's Exact Test for Count Data";
    if (nr === 2 && nc === 2)
        return fisher2x2(t, options, method);
    // For rxc, alternative etc. are not validated and are returned as given (as in R)
    return {
        method,
        alternative: (options.alternative ?? "two.sided"),
        pValue: fisherRxC(t),
    };
}
// ---- 2×2 ----
/** Noncentral hypergeometric distribution (the (1, 1) cell of a 2x2 table) */
class NoncentralHyper {
    m;
    n;
    k;
    lo;
    hi;
    logdc;
    constructor(m, n, k) {
        this.m = m;
        this.n = n;
        this.k = k;
        this.lo = Math.max(0, k - n);
        this.hi = Math.min(k, m);
        // log P(X = x). Computed with dhyper every 64 points, linked in between by the ratio of neighbours
        // P(x + 1) / P(x) = (m - x)(k - x) / ((x + 1)(n - k + x + 1)) (the log-ratio error is about
        // 1 ulp, so 63 chained steps stay within 1e-14; calling dhyper at every point is slow for large tables)
        const len = this.hi - this.lo + 1;
        this.logdc = new Float64Array(len);
        for (let i = 0; i < len; i++) {
            const x = this.lo + i;
            if (i % 64 === 0)
                this.logdc[i] = dhyper1(x, m, n, k, true);
            else {
                const y = x - 1;
                this.logdc[i] = this.logdc[i - 1] + Math.log(((m - y) * (k - y)) / ((y + 1) * (n - k + y + 1)));
            }
        }
    }
    /** Probabilities (in support order). The noncentrality ncp satisfies 0 < ncp < ∞ */
    density(ncp) {
        const lc = Math.log(ncp);
        const d = new Float64Array(this.logdc.length);
        let max = -Infinity;
        for (let i = 0; i < d.length; i++) {
            d[i] = this.logdc[i] + lc * (this.lo + i);
            if (d[i] > max)
                max = d[i];
        }
        // Skip exp where exp(d - max) underflows to 0 (R also gives 0 there)
        for (let i = 0; i < d.length; i++)
            d[i] = d[i] - max < -760 ? 0 : Math.exp(d[i] - max);
        const s = sumDD(d, 0, d.length);
        for (let i = 0; i < d.length; i++)
            d[i] = d[i] / s;
        return d;
    }
    mean(ncp) {
        if (ncp === 0)
            return this.lo;
        if (ncp === Infinity)
            return this.hi;
        const d = this.density(ncp);
        let s = [0, 0];
        for (let i = 0; i < d.length; i++)
            s = ddAdd(s, [(this.lo + i) * d[i], 0]);
        return s[0];
    }
    /** P(X <= q) (P(X >= q) if upper) */
    cdf(q, ncp, upper) {
        if (ncp === 1) {
            return upper ? phyper1(q - 1, this.m, this.n, this.k, false, false) : phyper1(q, this.m, this.n, this.k, true, false);
        }
        if (ncp === 0)
            return Number(upper ? q <= this.lo : q >= this.lo);
        if (ncp === Infinity)
            return Number(upper ? q <= this.hi : q >= this.hi);
        const d = this.density(ncp);
        const i = q - this.lo;
        return upper ? sumDD(d, i, d.length) : sumDD(d, 0, i + 1);
    }
}
function sumDD(d, from, to) {
    let s = [0, 0];
    for (let i = Math.max(0, from); i < Math.min(to, d.length); i++)
        s = ddAdd(s, [d[i], 0]);
    return s[0];
}
/**
 * Root of the increasing function f(ψ) = 0. If f(1) < 0 there is no root in ψ ∈ [0, 1], so search 1/ψ ∈ [ε, 1]
 * (the caller chooses the interval from the sign of f(1))
 */
function rootBelowOne(f) {
    return uniroot(f, 0, 1);
}
function rootAboveOne(f) {
    return 1 / uniroot((t) => f(1 / t), Number.EPSILON, 1);
}
function fisher2x2(t, options, method) {
    const alternative = matchAlternative(options.alternative);
    const or = options.or ?? 1;
    if (!(or >= 0))
        throw new RangeError("'or' must be a single number between 0 and Inf");
    const confLevel = options.confLevel ?? 0.95;
    if (!(confLevel > 0 && confLevel < 1))
        throw new RangeError("confLevel must be a single number between 0 and 1");
    const x = t[0][0];
    const m = x + t[1][0];
    const n = t[0][1] + t[1][1];
    const k = x + t[0][1];
    const h = new NoncentralHyper(m, n, k);
    let pValue;
    if (alternative === "less")
        pValue = h.cdf(x, or, false);
    else if (alternative === "greater")
        pValue = h.cdf(x, or, true);
    else if (or === 0)
        pValue = Number(x === h.lo);
    else if (or === Infinity)
        pValue = Number(x === h.hi);
    else {
        const d = h.density(or);
        const limit = d[x - h.lo] * REL_ERR;
        let s = [0, 0];
        for (const v of d)
            if (v <= limit)
                s = ddAdd(s, [v, 0]);
        pValue = s[0];
    }
    // Conditional MLE: the noncentrality whose mean is x
    let estimate;
    if (x === h.lo)
        estimate = 0;
    else if (x === h.hi)
        estimate = Infinity;
    else {
        const mu = h.mean(1);
        const f = (psi) => h.mean(psi) - x;
        estimate = mu > x ? rootBelowOne(f) : mu < x ? rootAboveOne(f) : 1;
    }
    const result = {
        method,
        alternative,
        pValue,
        estimate,
        estimateNames: "odds ratio",
        nullValue: or,
        nullValueName: "odds ratio",
    };
    if (options.confInt ?? true) {
        // Upper limit: P(X <= x; ψ) = α (P is decreasing in ψ)
        const upper = (alpha) => {
            if (x === h.hi)
                return Infinity;
            const p = h.cdf(x, 1, false);
            const f = (psi) => alpha - h.cdf(x, psi, false);
            return p < alpha ? rootBelowOne(f) : p > alpha ? rootAboveOne(f) : 1;
        };
        // Lower limit: P(X >= x; ψ) = α (P is increasing in ψ)
        const lower = (alpha) => {
            if (x === h.lo)
                return 0;
            const p = h.cdf(x, 1, true);
            const f = (psi) => h.cdf(x, psi, true) - alpha;
            return p > alpha ? rootBelowOne(f) : p < alpha ? rootAboveOne(f) : 1;
        };
        result.confInt =
            alternative === "less"
                ? [0, upper(1 - confLevel)]
                : alternative === "greater"
                    ? [lower(1 - confLevel), Infinity]
                    : [lower((1 - confLevel) / 2), upper((1 - confLevel) / 2)];
        result.confLevel = confLevel;
    }
    return result;
}
// ---- r×c ----
/** Table of log k! in double-double (extended as needed) */
const LOG_FACT = [[0, 0]];
function logFact(k) {
    for (let i = LOG_FACT.length; i <= k; i++)
        LOG_FACT.push(ddAdd(LOG_FACT[i - 1], ddLog([i, 0])));
    return LOG_FACT[k];
}
/** Double-double sum hi + lo (simplified Dekker; exact when the summands have the same sign or differ in magnitude) */
function dd2(ah, al, bh, bl) {
    const s = ah + bh;
    const bb = s - ah;
    const e = ah - (s - bb) + (bh - bb) + al + bl;
    const h = s + e;
    return [h, e - (h - s)];
}
/** A sum of probabilities held as a sum of log-shifted values (avoids overflow and underflow to 0) */
class LogSum {
    scale = -Infinity;
    hi = 0;
    lo = 0;
    /** Add w × exp(lh + ll) */
    add(lh, ll, w) {
        if (lh > this.scale) {
            const r = Number.isFinite(this.scale) ? Math.exp(this.scale - lh) : 0;
            this.hi *= r;
            this.lo *= r;
            this.scale = lh;
        }
        const v = w * Math.exp(lh - this.scale) * (1 + ll);
        const s = this.hi + v;
        const bb = s - this.hi;
        const e = this.hi - (s - bb) + (v - bb) + this.lo;
        this.hi = s + e;
        this.lo = e - (this.hi - s);
    }
    value() {
        return this.scale === -Infinity ? 0 : this.hi * Math.exp(this.scale);
    }
}
function fisherRxC(t) {
    // Drop rows and columns with zero sum (they do not affect the probability)
    let rows = t.filter((r) => r.some((v) => v > 0));
    if (rows.length === 0)
        throw new RangeError("all entries of the table are zero");
    const keep = rows[0].map((_, j) => rows.some((r) => r[j] > 0));
    rows = rows.map((r) => r.filter((_, j) => keep[j]));
    if (rows.length < 2 || rows[0].length < 2)
        return 1;
    // Fewer rows means fewer nodes and edges, so orient the table with rows <= columns
    if (rows.length > rows[0].length)
        rows = rows[0].map((_, j) => rows.map((r) => r[j]));
    const nr = rows.length;
    const rowSums = rows.map((r) => r.reduce((a, b) => a + b, 0));
    // Traverse columns in decreasing order (remaining row sums shrink sooner, giving fewer nodes)
    const colSums = rows[0].map((_, j) => rows.reduce((a, r) => a + r[j], 0)).sort((a, b) => b - a);
    const ncol = colSums.length;
    const total = rowSums.reduce((a, b) => a + b, 0);
    // Table probability = exp(K - Σ log x!), K = Σ log r! + Σ log c! - log n!
    let K = ddNeg(logFact(total));
    for (const r of rowSums)
        K = ddAdd(K, logFact(r));
    for (const c of colSums)
        K = ddAdd(K, logFact(c));
    let obs = [0, 0];
    for (const v of rows.flat())
        obs = ddSub(obs, logFact(v));
    // Threshold: -Σ log x! <= obs + log(1 + 1e-7)
    const thr = ddAdd(obs, [Math.log1p(1e-7), 0]);
    // The upper and lower bounds are in double precision, so near the threshold do not decide early; keep going
    const margin = 1e-9 * (1 + Math.abs(thr[0]));
    const [thrHi, thrLo] = thr;
    // Build the network (a node at stage j is determined by the multiset R of remaining row sums; R is ascending)
    const levels = Array.from({ length: ncol }, () => new Map());
    const nodeOf = (j, R) => {
        const key = R.join(",");
        const hit = levels[j].get(key);
        if (hit !== undefined)
            return hit;
        let KZ = ddAdd(K, logFact(R.reduce((a, b) => a + b, 0)));
        for (const r of R)
            KZ = ddSub(KZ, logFact(r));
        for (let jj = j; jj < ncol; jj++)
            KZ = ddSub(KZ, logFact(colSums[jj]));
        const node = { R, KZ, max: 0, min: 0, edges: [], pastHi: [], pastLo: [], count: [], index: new Map() };
        levels[j].set(key, node);
        if (j === ncol - 1) {
            // The last column is determined by the remaining row sums
            let v = [0, 0];
            for (const r of R)
                v = ddSub(v, logFact(r));
            node.max = node.min = v[0];
            node.edges.push({ to: node, hi: v[0], lo: v[1], mult: 1 });
            return node;
        }
        // Enumerate the cell combinations xs of column j (0 <= xs[i] <= R[i], summing to colSums[j])
        const groups = new Map();
        const tail = new Array(nr + 1).fill(0);
        for (let i = nr - 1; i >= 0; i--)
            tail[i] = tail[i + 1] + R[i];
        const xs = new Array(nr).fill(0);
        const rec = (i, rest, edge) => {
            if (i === nr - 1) {
                xs[i] = rest;
                const e = ddSub(edge, logFact(rest));
                const R2 = R.map((r, k) => r - xs[k]).sort((a, b) => a - b);
                const to = nodeOf(j + 1, R2);
                const gk = `${R2.join(",")}|${e[0]}`;
                const g = groups.get(gk);
                if (g === undefined)
                    groups.set(gk, { to, hi: e[0], lo: e[1], mult: 1 });
                else
                    g.mult++;
                return;
            }
            const from = Math.max(0, rest - tail[i + 1]);
            const to = Math.min(R[i], rest);
            for (let v = from; v <= to; v++) {
                xs[i] = v;
                rec(i + 1, rest - v, ddSub(edge, logFact(v)));
            }
        };
        rec(0, colSums[j], [0, 0]);
        node.edges = [...groups.values()];
        node.max = Math.max(...node.edges.map((e) => e.hi + e.to.max));
        node.min = Math.min(...node.edges.map((e) => e.hi + e.to.min));
        if (j === ncol - 2) {
            // With two columns left, the rest of the table is determined by a single edge. Sort by value and take cumulative sums,
            // then find the threshold position per path by binary search (reducing paths × edges work to paths × log(edges))
            const vals = node.edges.map((e) => {
                const leaf = e.to.edges[0];
                return { v: ddAdd([e.hi, e.lo], [leaf.hi, leaf.lo]), mult: e.mult };
            });
            vals.sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1]);
            const n = vals.length;
            const vmax = vals[n - 1].v[0];
            const hi = new Float64Array(n);
            const lo = new Float64Array(n);
            const cum = new Float64Array(n);
            let acc = [0, 0];
            vals.forEach(({ v, mult }, i) => {
                hi[i] = v[0];
                lo[i] = v[1];
                const d = ddSub(v, [vmax, 0]);
                acc = ddAdd(acc, [mult * Math.exp(d[0]) * (1 + d[1]), 0]);
                cum[i] = acc[0];
            });
            node.dist = { hi, lo, cum, vmax, kv: ddAdd(K, [vmax, 0]) };
        }
        return node;
    };
    const root = nodeOf(0, [...rowSums].sort((a, b) => a - b));
    const p = new LogSum();
    /**
     * Settle count paths that reached a node with past, without enumerating beyond. If everything beyond is below the threshold,
     * add them all; if everything exceeds it, drop them; with two columns left, add via binary search. Returns false if unsettled
     */
    const settle = (node, ph, pl, count) => {
        if (ph + node.max <= thrHi - margin) {
            const [lh, ll] = dd2(node.KZ[0], node.KZ[1], ph, pl);
            p.add(lh, ll, count);
            return true;
        }
        if (ph + node.min > thrHi + margin)
            return true;
        const dist = node.dist;
        if (dist === undefined)
            return false;
        // Sum of the values v beyond such that past + v <= thr (v <= thr - past)
        const [ch, cl] = dd2(thrHi, thrLo, -ph, -pl);
        let a = 0;
        let b = dist.hi.length;
        while (a < b) {
            const mid = (a + b) >>> 1;
            const vh = dist.hi[mid];
            if (vh < ch || (vh === ch && dist.lo[mid] <= cl))
                a = mid + 1;
            else
                b = mid;
        }
        if (a > 0) {
            const [lh, ll] = dd2(dist.kv[0], dist.kv[1], ph, pl);
            p.add(lh, ll, count * dist.cum[a - 1]);
        }
        return true;
    };
    if (!settle(root, 0, 0, 1)) {
        root.pastHi.push(0);
        root.pastLo.push(0);
        root.count.push(1);
    }
    for (let j = 0; j < ncol - 2; j++) {
        for (const node of levels[j].values()) {
            const { pastHi, pastLo, count } = node;
            if (count.length === 0)
                continue;
            for (const { to, hi: eh, lo: el, mult } of node.edges) {
                for (let i = 0; i < count.length; i++) {
                    // Both signs are negative, so the simplified double-double sum suffices
                    const [h, l] = dd2(pastHi[i], pastLo[i], eh, el);
                    const c = count[i] * mult;
                    if (settle(to, h, l, c))
                        continue;
                    // Unsettled paths with the same value are merged and advanced at the next stage
                    const k = to.index.get(h);
                    if (k === undefined) {
                        to.index.set(h, to.count.length);
                        to.pastHi.push(h);
                        to.pastLo.push(l);
                        to.count.push(c);
                    }
                    else
                        to.count[k] += c;
                }
            }
            // Discard paths that have been used
            node.pastHi = node.pastLo = node.count = [];
            node.index.clear();
        }
    }
    return Math.min(1, p.value());
}
