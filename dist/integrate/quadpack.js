// Adaptive quadrature from QUADPACK: dqagse (finite interval) and dqagie (infinite interval), the routines behind
// R's integrate().
//
// Ported from SciPy's C translation of QUADPACK, scipy/integrate/__quadpack.c (SciPy commit 5ccd743;
// Copyright (C) 2024 SciPy developers, BSD-3-Clause). QUADPACK itself (Piessens, de Doncker-Kapenga, Überhuber,
// Kahaner) is in the public domain. See THIRD_PARTY_NOTICES.md.
//
// The control flow (gotos in the C code) is kept step for step, so that the sequence of subdivisions, and hence the
// result, error estimate and counts, are those of the original.
const EPMACH = 2.220446049250313e-16;
const UFLOW = 2.2250738585072014e-308;
const OFLOW = 1.7976931348623157e308;
const K21_WG = [
    0.066671344308688137593568809893332, 0.149451349150580593145776339657697, 0.219086362515982043995534934228163,
    0.269266719309996355091226921569469, 0.295524224714752870173892994651338,
];
const K21_XGK = [
    0.995657163025808080735527280689003, 0.973906528517171720077964012084452, 0.930157491355708226001207180059508,
    0.865063366688984510732096688423493, 0.780817726586416897063717578345042, 0.679409568299024406234327365114874,
    0.562757134668604683339000099272694, 0.433395394129247190799265943165784, 0.294392862701460198131126603103866,
    0.148874338981631210884826001129720, 0,
];
const K21_WGK = [
    0.011694638867371874278064396062192, 0.032558162307964727478818972459390, 0.054755896574351996031381300244580,
    0.075039674810919952767043140916190, 0.093125454583697605535065465083366, 0.109387158802297641899210590325805,
    0.123491976262065851077958109831074, 0.134709217311473325928054001771707, 0.142775938577060080797094273138717,
    0.147739104901338491374841515972068, 0.149445554002916905664936468389821,
];
/** Error estimate shared by the Gauss-Kronrod rules */
function ruleError(resk, resg, hlgth, resabs, resasc) {
    let abserr = Math.abs((resk - resg) * hlgth);
    if (resasc !== 0 && abserr !== 0)
        abserr = resasc * Math.min(1, Math.pow((200 * abserr) / resasc, 1.5));
    if (resabs > UFLOW / (50 * EPMACH))
        abserr = Math.max(EPMACH * 50 * resabs, abserr);
    return abserr;
}
/** 21-point Gauss-Kronrod rule on [a, b] */
function dqk21(f, a, b) {
    const centr = 0.5 * (a + b);
    const hlgth = 0.5 * (b - a);
    const dhlgth = Math.abs(hlgth);
    const fv1 = new Array(10);
    const fv2 = new Array(10);
    const fc = f(centr);
    let resg = 0;
    let resk = K21_WGK[10] * fc;
    let resabs = Math.abs(resk);
    for (let j = 0; j < 5; j++) {
        const jtw = 2 * j + 1;
        const absc = hlgth * K21_XGK[jtw];
        const fval1 = f(centr - absc);
        const fval2 = f(centr + absc);
        fv1[jtw] = fval1;
        fv2[jtw] = fval2;
        const fsum = fval1 + fval2;
        resg += K21_WG[j] * fsum;
        resk += K21_WGK[jtw] * fsum;
        resabs += K21_WGK[jtw] * (Math.abs(fval1) + Math.abs(fval2));
    }
    for (let j = 0; j < 5; j++) {
        const jtwm1 = 2 * j;
        const absc = hlgth * K21_XGK[jtwm1];
        const fval1 = f(centr - absc);
        const fval2 = f(centr + absc);
        fv1[jtwm1] = fval1;
        fv2[jtwm1] = fval2;
        const fsum = fval1 + fval2;
        resk += K21_WGK[jtwm1] * fsum;
        resabs += K21_WGK[jtwm1] * (Math.abs(fval1) + Math.abs(fval2));
    }
    const reskh = resk * 0.5;
    let resasc = K21_WGK[10] * Math.abs(fc - reskh);
    for (let j = 0; j < 10; j++)
        resasc += K21_WGK[j] * (Math.abs(fv1[j] - reskh) + Math.abs(fv2[j] - reskh));
    resabs *= dhlgth;
    resasc *= dhlgth;
    return { result: resk * hlgth, abserr: ruleError(resk, resg, hlgth, resabs, resasc), resabs, resasc };
}
const K15I_WG = [
    0, 0.129484966168869693270611432679082, 0, 0.279705391489276667901467771423780, 0,
    0.381830050505118944950369775488975, 0, 0.417959183673469387755102040816327,
];
const K15I_XGK = [
    0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926,
    0.741531185599394439863864773280788, 0.586087235467691130294144838258730, 0.405845151377397166906606412076961,
    0.207784955007898467600689403773245, 0,
];
const K15I_WGK = [
    0.022935322010529224963732008058970, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518,
    0.140653259715525918745189590510238, 0.169004726639267902826583426598550, 0.190350578064785409913256402421014,
    0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
/**
 * 15-point transformed Gauss-Kronrod rule on [a, b] within (0, 1] for an infinite range: x = boun + dinf (1 - t) / t
 * (inf = 1: (boun, inf), -1: (-inf, boun), 2: (-inf, inf) with boun = 0, f(x) + f(-x))
 */
function dqk15i(f, boun, inf, a, b) {
    const dinf = inf > 1 ? 1 : inf;
    const centr = 0.5 * (a + b);
    const hlgth = 0.5 * (b - a);
    const fv1 = new Array(7);
    const fv2 = new Array(7);
    const at = (t) => {
        const x = boun + (dinf * (1 - t)) / t;
        let v = f(x);
        if (inf === 2)
            v += f(-x);
        return v;
    };
    const fc = at(centr) / centr / centr;
    let resg = fc * K15I_WG[7];
    let resk = fc * K15I_WGK[7];
    let resabs = Math.abs(resk);
    for (let j = 0; j < 7; j++) {
        const absc = hlgth * K15I_XGK[j];
        const absc1 = centr - absc;
        const absc2 = centr + absc;
        let fval1 = at(absc1);
        let fval2 = at(absc2);
        fval1 = fval1 / absc1 / absc1;
        fval2 = fval2 / absc2 / absc2;
        fv1[j] = fval1;
        fv2[j] = fval2;
        const fsum = fval1 + fval2;
        resg += K15I_WG[j] * fsum;
        resk += K15I_WGK[j] * fsum;
        resabs += K15I_WGK[j] * (Math.abs(fval1) + Math.abs(fval2));
    }
    const reskh = resk * 0.5;
    let resasc = K15I_WGK[7] * Math.abs(fc - reskh);
    for (let j = 0; j < 7; j++)
        resasc += K15I_WGK[j] * (Math.abs(fv1[j] - reskh) + Math.abs(fv2[j] - reskh));
    resabs *= hlgth;
    resasc *= hlgth;
    return { result: resk * hlgth, abserr: ruleError(resk, resg, hlgth, resabs, resasc), resabs, resasc };
}
/** Wynn's epsilon algorithm; returns [result, abserr] and updates the table */
function dqelg(t) {
    const epstab = t.epstab;
    const startingN = t.n;
    t.nres += 1;
    let abserr = OFLOW;
    let result = epstab[t.n];
    if (t.n < 2) {
        abserr = Math.max(abserr, 5 * EPMACH * Math.abs(result));
        return [result, abserr];
    }
    const limexp = 49;
    epstab[t.n + 2] = epstab[t.n];
    const newelm = Math.trunc(t.n / 2);
    epstab[t.n] = OFLOW;
    let k1 = t.n;
    for (let i = 0; i < newelm; i++) {
        const k2 = k1 - 1;
        const k3 = k1 - 2;
        let res = epstab[k1 + 2];
        const e0 = epstab[k3];
        const e1 = epstab[k2];
        const e2 = res;
        const e1abs = Math.abs(e1);
        const delta2 = e2 - e1;
        const err2 = Math.abs(delta2);
        const tol2 = Math.max(Math.abs(e2), e1abs) * EPMACH;
        const delta3 = e1 - e0;
        const err3 = Math.abs(delta3);
        const tol3 = Math.max(e1abs, Math.abs(e0)) * EPMACH;
        if (!(err2 > tol2 || err3 > tol3)) {
            result = res;
            abserr = err2 + err3;
            abserr = Math.max(abserr, 5 * EPMACH * Math.abs(result));
            return [result, abserr];
        }
        const e3 = epstab[k1];
        epstab[k1] = e1;
        const delta1 = e1 - e3;
        const err1 = Math.abs(delta1);
        const tol1 = Math.max(e1abs, Math.abs(e3)) * EPMACH;
        if (err1 <= tol1 || err2 <= tol2 || err3 <= tol3) {
            t.n = i + i;
            break;
        }
        const ss = 1 / delta1 + 1 / delta2 - 1 / delta3;
        const epsinf = Math.abs(ss * e1);
        if (!(epsinf > 1e-4)) {
            t.n = i + i;
            break;
        }
        res = e1 + 1 / ss;
        epstab[k1] = res;
        k1 -= 2;
        const error = err2 + Math.abs(res - e2) + err3;
        if (!(error > abserr)) {
            abserr = error;
            result = res;
        }
    }
    if (t.n === limexp)
        t.n = 2 * Math.trunc(limexp / 2);
    const n2rem = startingN % 2;
    for (let i = 0; i <= newelm; i++)
        epstab[2 * i + n2rem] = epstab[2 * i + 2 + n2rem];
    if (t.n !== startingN) {
        let indx = startingN - t.n;
        for (let i = 0; i <= t.n; i++) {
            epstab[i] = epstab[indx];
            indx++;
        }
    }
    const r = t.res3la;
    if (t.nres < 4) {
        r[t.nres - 1] = result;
        abserr = OFLOW;
    }
    else {
        abserr = Math.abs(result - r[2]) + Math.abs(result - r[1]) + Math.abs(result - r[0]);
        r[0] = r[1];
        r[1] = r[2];
        r[2] = result;
    }
    abserr = Math.max(abserr, 5 * EPMACH * Math.abs(result));
    return [result, abserr];
}
/** Ordering of the error estimates (dqpsrt); returns [maxerr, ermax, nrmax] */
function dqpsrt(limit, last, maxerr, elist, iord, nrmax) {
    if (last <= 2) {
        iord[0] = 0;
        iord[1] = 1;
        const m = iord[nrmax];
        return [m, elist[m], nrmax];
    }
    const errmax = elist[maxerr];
    while (nrmax > 0 && errmax > elist[iord[nrmax - 1]]) {
        iord[nrmax] = iord[nrmax - 1];
        nrmax -= 1;
    }
    const jupbn = last > Math.trunc(limit / 2) + 2 ? limit - last + 2 : last - 1;
    const errmin = elist[last - 1];
    const jbnd = jupbn - 1;
    const ibeg = nrmax + 1;
    let i = ibeg;
    let found = false;
    if (ibeg <= jbnd) {
        for (i = ibeg; i <= jbnd; i++) {
            if (errmax >= elist[iord[i]]) {
                found = true;
                break;
            }
            iord[i - 1] = iord[i];
        }
    }
    if (!found) {
        iord[jbnd] = maxerr;
        iord[jupbn] = last - 1;
    }
    else {
        iord[i - 1] = maxerr;
        let k = jbnd;
        for (let j = i; j <= jbnd; j++) {
            if (errmin < elist[iord[k]])
                break;
            iord[k + 1] = iord[k];
            k--;
        }
        if (errmin < elist[iord[k]])
            iord[k + 1] = last - 1;
        else
            iord[i] = last - 1;
    }
    const m = iord[nrmax];
    return [m, elist[m], nrmax];
}
/**
 * The globally adaptive loop shared by dqagse and dqagie: `rule(a, b)` integrates over [a, b] of the (possibly
 * transformed) range [a0, b0]; `neval` gives the number of evaluations from the number of subintervals
 */
function adaptive(rule, a0, b0, epsabs, epsrel, limit, smallStart, neval) {
    const alist = new Float64Array(limit + 1);
    const blist = new Float64Array(limit + 1);
    const rlist = new Float64Array(limit + 1);
    const elist = new Float64Array(limit + 1);
    const iord = new Int32Array(limit + 1);
    let ier = 0;
    let last = 0;
    let result = 0;
    let abserr = 0;
    alist[0] = a0;
    blist[0] = b0;
    if (epsabs <= 0 && epsrel < Math.max(50 * EPMACH, 0.5e-28))
        return { result: 0, abserr: 0, neval: 0, ier: 6, last: 0 };
    // first approximation to the integral
    const r0 = rule(a0, b0);
    result = r0.result;
    abserr = r0.abserr;
    const defabs = r0.resabs;
    const resabs0 = r0.resasc;
    const dres = Math.abs(result);
    let errbnd = Math.max(epsabs, epsrel * dres);
    last = 1;
    rlist[0] = result;
    elist[0] = abserr;
    iord[0] = 0;
    if (abserr <= 100 * EPMACH * defabs && abserr > errbnd)
        ier = 2;
    if (limit === 1)
        ier = 1;
    if (ier !== 0 || (abserr <= errbnd && abserr !== resabs0) || abserr === 0) {
        return { result, abserr, neval: neval(last), ier, last };
    }
    const eps = { epstab: new Float64Array(52), res3la: new Float64Array(3), n: 1, nres: 0 };
    eps.epstab[0] = result;
    let errmax = abserr;
    let maxerr = 0;
    let area = result;
    let errsum = abserr;
    abserr = OFLOW;
    let nrmax = 0;
    let ktmin = 0;
    let extrap = false;
    let noext = false;
    let ierror = 0;
    let iroff1 = 0;
    let iroff2 = 0;
    let iroff3 = 0;
    let small = 0;
    let erlarg = 0;
    let ertest = 0;
    let correc = 0;
    // >= in both routines, as in QUADPACK's dqagse.f and dqagie.f and R's integrate.c (SciPy's dqagie has >)
    const ksgn = dres >= (1 - 50 * EPMACH) * defabs ? 1 : -1;
    let sumAll = false; // goto LINE115
    let L = 1;
    for (L = 1; L < limit; L++) {
        last = L + 1;
        // bisect the subinterval with the nrmax-th largest error estimate
        const a1 = alist[maxerr];
        const b1 = 0.5 * (alist[maxerr] + blist[maxerr]);
        const a2 = b1;
        const b2 = blist[maxerr];
        const erlast = errmax;
        const r1 = rule(a1, b1);
        const r2 = rule(a2, b2);
        const area1 = r1.result;
        const error1 = r1.abserr;
        const defab1 = r1.resasc;
        const area2 = r2.result;
        const error2 = r2.abserr;
        const defab2 = r2.resasc;
        // improve previous approximations to integral and error and test for accuracy
        const area12 = area1 + area2;
        const error12 = error1 + error2;
        errsum = errsum + error12 - errmax;
        area = area + area12 - rlist[maxerr];
        if (defab1 !== error1 && defab2 !== error2) {
            if (!(Math.abs(rlist[maxerr] - area12) > 1e-5 * Math.abs(area12) || error12 < 0.99 * errmax)) {
                if (extrap)
                    iroff2++;
                else
                    iroff1++;
            }
            if (L > 9 && error12 > errmax)
                iroff3++;
        }
        rlist[maxerr] = area1;
        rlist[L] = area2;
        errbnd = Math.max(epsabs, epsrel * Math.abs(area));
        // test for roundoff error and eventually set error flag
        if (iroff1 + iroff2 >= 10 || iroff3 >= 20)
            ier = 2;
        if (iroff2 >= 5)
            ierror = 3;
        // number of subintervals equals limit
        if (last === limit)
            ier = 1;
        // bad integrand behaviour at some points of the integration range
        if (Math.max(Math.abs(a1), Math.abs(b2)) <= (1 + 100 * EPMACH) * (Math.abs(a2) + 1000 * UFLOW))
            ier = 4;
        // append the newly-created intervals to the list
        if (!(error2 > error1)) {
            alist[L] = a2;
            blist[maxerr] = b1;
            blist[L] = b2;
            elist[maxerr] = error1;
            elist[L] = error2;
        }
        else {
            alist[maxerr] = a2;
            alist[L] = a1;
            blist[L] = b1;
            rlist[maxerr] = area2;
            rlist[L] = area1;
            elist[maxerr] = error2;
            elist[L] = error1;
        }
        // maintain the descending ordering of the error estimates and select the next subinterval
        [maxerr, errmax, nrmax] = dqpsrt(limit, last, maxerr, elist, iord, nrmax);
        if (errsum <= errbnd) {
            sumAll = true;
            break;
        }
        if (ier !== 0)
            break;
        if (L === 1) {
            // LINE80
            small = smallStart;
            erlarg = errsum;
            ertest = errbnd;
            eps.epstab[1] = area;
            continue;
        }
        if (noext)
            continue;
        erlarg -= erlast;
        if (Math.abs(b1 - a1) > small)
            erlarg += error12;
        if (!extrap) {
            // test whether the interval to be bisected next is the smallest interval
            if (Math.abs(blist[maxerr] - alist[maxerr]) > small)
                continue;
            extrap = true;
            nrmax = 1;
        }
        if (!(ierror === 3 || erlarg <= ertest)) {
            // the smallest interval has the largest error: before bisecting, decrease the sum of the errors over the
            // larger intervals (erlarg) and perform extrapolation
            const jupbnd = last > 2 + Math.trunc(limit / 2) ? limit + 3 - last : last;
            let larger = false;
            for (let k = nrmax; k < jupbnd; k++) {
                maxerr = iord[nrmax];
                errmax = elist[maxerr];
                if (Math.abs(blist[maxerr] - alist[maxerr]) > small) {
                    larger = true;
                    break;
                }
                nrmax++;
            }
            if (larger)
                continue; // LINE90
        }
        // LINE60: perform extrapolation
        eps.n += 1;
        eps.epstab[eps.n] = area;
        const [reseps, abseps] = dqelg(eps);
        ktmin += 1;
        if (ktmin > 5 && abserr < 1e-3 * errsum)
            ier = 5;
        if (abseps < abserr) {
            ktmin = 0;
            abserr = abseps;
            result = reseps;
            correc = erlarg;
            ertest = Math.max(epsabs, epsrel * Math.abs(reseps));
            if (abserr <= ertest)
                break;
        }
        // LINE70: prepare bisection of the smallest interval
        if (eps.n === 0)
            noext = true;
        if (ier === 5)
            break;
        maxerr = iord[0];
        errmax = elist[maxerr];
        nrmax = 0;
        extrap = false;
        small *= 0.5;
        erlarg = errsum;
    }
    let label;
    if (sumAll || abserr === OFLOW)
        label = 115;
    else if (ier + ierror === 0)
        label = 110;
    else {
        if (ierror === 3)
            abserr += correc;
        if (ier === 0)
            ier = 3;
        if (result !== 0 && area !== 0)
            label = 105;
        else if (abserr > errsum)
            label = 115;
        else if (area === 0)
            label = 130;
        else
            label = 110;
    }
    if (label === 105)
        label = abserr / Math.abs(result) > errsum / Math.abs(area) ? 115 : 110;
    if (label === 110) {
        // test on divergence
        if (!(ksgn === -1 && Math.max(Math.abs(result), Math.abs(area)) <= defabs * 0.01)) {
            if (0.01 > result / area || result / area > 100 || errsum > Math.abs(area))
                ier = 6;
        }
    }
    else if (label === 115) {
        // compute the global integral sum
        result = 0;
        for (let k = 0; k <= L; k++)
            result += rlist[k];
        abserr = errsum;
    }
    if (ier > 2)
        ier -= 1;
    return { result, abserr, neval: neval(last), ier, last };
}
/**
 * Integral of f over the finite interval [a, b] (QUADPACK dqagse: 21-point Gauss-Kronrod rule, bisection of the
 * interval with the largest error, epsilon-algorithm extrapolation).
 *
 * @param limit - Maximum number of subintervals (R's `subdivisions`).
 */
export function dqagse(f, a, b, epsabs, epsrel, limit) {
    return adaptive((x, y) => dqk21(f, x, y), a, b, epsabs, epsrel, limit, Math.abs(b - a) * 0.375, (last) => 42 * last - 21);
}
/**
 * Integral of f over an infinite range (QUADPACK dqagie): (bound, inf) for inf = 1, (-inf, bound) for inf = -1,
 * (-inf, inf) for inf = 2, mapped to (0, 1] by x = bound + (1 - t) / t.
 *
 * @param limit - Maximum number of subintervals (R's `subdivisions`).
 */
export function dqagie(f, bound, inf, epsabs, epsrel, limit) {
    const boun = inf === 2 ? 0 : bound;
    return adaptive((x, y) => dqk15i(f, boun, inf, x, y), 0, 1, epsabs, epsrel, limit, 0.375, (last) => (30 * last - 15) * (inf === 2 ? 2 : 1));
}
