# Third-party notices

rStats.js contains code ported (translated into TypeScript) from the projects
listed below. Each ported file names its source at the top.

---

## xsf

- Source: https://github.com/scipy/xsf (commit c6a3afe)
- Used in: `src/special/beta.ts`, `src/special/constants.ts`, `src/special/erf.ts`, `src/special/gamma.ts`, `src/special/igam.ts`, `src/special/igamAsympCoeff.ts`, `src/special/igami.ts`, `src/special/incbet.ts`, `src/special/log1pmx.ts`, `src/special/ndtri.ts`, `src/special/polevl.ts`, `src/special/psigamma.ts`
- License: BSD-3-Clause
- `include/xsf/ndtri_exp.h` (used in `src/special/ndtri.ts`): Copyright Albert Steppi,
  distributed under the same license as SciPy (BSD-3-Clause)

```
BSD 3-Clause License

Copyright (c) 2024, SciPy

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Cephes Math Library (as bundled in xsf)

- Source: `include/xsf/cephes/*` in xsf
- Used in: the files above that cite `include/xsf/cephes/*`
- License: BSD-3-Clause, distributed with permission from the author
  (see https://lists.debian.org/debian-legal/2004/12/msg00295.html)

```
Distributed under 3-clause BSD license with permission from the author,
see https://lists.debian.org/debian-legal/2004/12/msg00295.html

Cephes Math Library Release 2.8:  June, 2000
Copyright 1984, 1995, 2000 by Stephen L. Moshier

This software is derived from the Cephes Math Library and is
incorporated herein by permission of the author.

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the <organization> nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

```

---

## Boost.Math

- Source: https://github.com/boostorg/math (commit 4a6ce78)
  - `include/boost/math/distributions/non_central_chi_squared.hpp`
  - `include/boost/math/distributions/non_central_t.hpp`
- Used in: `src/internal/poissonMixture.ts`, `src/distributions/nt.ts` (consulted as a reference for the
  algorithms — Poisson-mixture summation starting near the mode, and the integral
  P[T <= t] = E[Φ(tS - δ)] for the non-central t; the TypeScript code was written independently)
- License: Boost Software License 1.0
- Also: the rational approximation of digamma on [1, 2] in `src/special/psigamma.ts`, which xsf's
  `include/xsf/cephes/psi.h` takes from Boost ((C) Copyright John Maddock 2006)
- Ported (Boost.Math commit 0a0fb4e): `include/boost/math/special_functions/detail/bessel_ik.hpp`,
  `detail/bessel_jy.hpp`, `detail/bessel_jy_series.hpp`, `detail/bessel_jy_asym.hpp` and the
  dispatch in `bessel.hpp`, in `src/special/besselIK.ts` and `src/special/besselJY.ts`
  (Copyright (c) 2006 Xiaogang Zhang, (c) 2007 John Maddock, (c) 2024 Matt Borland)

```
Boost Software License - Version 1.0 - August 17th, 2003

Permission is hereby granted, free of charge, to any person or organization
obtaining a copy of the software and accompanying documentation covered by
this license (the "Software") to use, reproduce, display, distribute,
execute, and transmit the Software, and to prepare derivative works of the
Software, and to permit third-parties to whom the Software is furnished to
do so, all subject to the following:

The copyright notices in the Software and this entire statement, including
the above license grant, this restriction and the following disclaimer,
must be included in all copies of the Software, in whole or in part, and
all derivative works of the Software, unless such copies or derivative
works are solely in the form of machine-executable object code generated by
a source language processor.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT
SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE
FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

Boost.Math: Copyright John Maddock 2008, Matt Borland 2024 (and other contributors).

---

## SciPy (scipy.stats, scipy.integrate)

- Source: https://github.com/scipy/scipy (commit a087e61)
  - `scipy/stats/_stats_py.py` (ttest_1samp / ttest_ind / ttest_rel, chisquare, pearsonr)
  - `scipy/stats/contingency.py` (chi2_contingency, expected_freq)
  - `scipy/stats/_wilcoxon.py`, `scipy/stats/_mannwhitneyu.py`
  - `scipy/stats/_mstats_basic.py` (kendalltau, `_kendall_p_exact`)
- Used in: `src/htest/tTest.ts`, `src/htest/chisqTest.ts`, `src/htest/wilcoxTest.ts`, `src/htest/cor.ts`
- License: BSD-3-Clause
- Ported (SciPy commit 5ccd743): `scipy/integrate/__quadpack.c`, SciPy's C translation of QUADPACK
  (`dqagse`, `dqagie` and their rules), in `src/integrate/quadpack.ts` (Copyright (C) 2024 SciPy
  developers, BSD-3-Clause; QUADPACK itself is in the public domain, see below)

```
Copyright (c) 2001-2002 Enthought, Inc. 2003, SciPy Developers.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above
   copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided
   with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived
   from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## statsmodels

- Source: https://github.com/statsmodels/statsmodels (commit 5c65604)
  - `statsmodels/stats/multitest.py` (multipletests, method = "hommel")
- Used in: `src/htest/pAdjust.ts`
- License: BSD-3-Clause

```
Copyright (C) 2006, Jonathan E. Taylor
All rights reserved.

Copyright (c) 2006-2008 Scipy Developers.
All rights reserved.

Copyright (c) 2009-2018 statsmodels Developers.
All rights reserved.


Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  a. Redistributions of source code must retain the above copyright notice,
     this list of conditions and the following disclaimer.
  b. Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in the
     documentation and/or other materials provided with the distribution.
  c. Neither the name of statsmodels nor the names of its contributors
     may be used to endorse or promote products derived from this software
     without specific prior written permission.


THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL STATSMODELS OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
```

---

## LAPACK

- Source: https://github.com/Reference-LAPACK/lapack (tag v3.12.0)
  - `BLAS/SRC/dtrsm.f`, `SRC/dlange.f`, `SRC/dpotf2.f`, `SRC/dpstf2.f`, `SRC/dpotri.f` (`dtrti2.f`, `dlauu2.f`),
    `SRC/dgeqp3.f` (`dlaqp2.f`, `dlarfg.f`, `dlarf.f`), `SRC/dorm2r.f`, `SRC/dgetf2.f`, `SRC/dgetrs.f`,
    `SRC/dgecon.f`, `SRC/dtrcon.f`, `SRC/dlacn2.f`
- Used in: `src/linalg/basic.ts`, `src/linalg/norm.ts`, `src/linalg/chol.ts`, `src/linalg/qr.ts`, `src/linalg/solve.ts`, `src/linalg/svd.ts`
- License: modified BSD

```
Copyright (c) 1992-2023 The University of Tennessee and The University
                        of Tennessee Research Foundation.  All rights
                        reserved.
Copyright (c) 2000-2023 The University of California Berkeley. All
                        rights reserved.
Copyright (c) 2006-2023 The University of Colorado Denver.  All rights
                        reserved.

$COPYRIGHT$

Additional copyrights may follow

$HEADER$

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

- Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.

- Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer listed
  in this license in the documentation and/or other materials
  provided with the distribution.

- Neither the name of the copyright holders nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

The copyright holders provide no reassurances that the source code
provided does not infringe any patent, copyright, or any other
intellectual property rights of third parties.  The copyright holders
disclaim any liability to any recipient for claims brought against
recipient by any third party for infringement of that parties
intellectual property rights.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Public-domain sources (listed for attribution)

The following algorithms come from public-domain software. No license terms apply;
they are listed so that readers can find the originals.

- LINPACK (Dongarra, Bunch, Moler, Stewart 1979): `dqrdc` (Householder QR, used with the
  column-pivoting rule of R observed from its output) and `dtrco` (condition estimate) —
  `src/linalg/qr.ts`, `src/linalg/kappa.ts`
- EISPACK / JAMA (NIST and The MathWorks): `svd` (Golub–Reinsch), `tred2`, `tql2`, `orthes`, `hqr2` —
  `src/linalg/svd.ts`, `src/linalg/eigen.ts`
- FMM (Forsythe, Malcolm, Moler, "Computer Methods for Mathematical Computations", 1977; netlib
  https://netlib.org/fmm/spline.f): `spline` (cubic spline coefficients with end third derivatives from
  divided differences), the "fmm" method — `src/numerics/interp.ts`
- netlib go (https://netlib.org/go/zeroin.f; Brent, "Algorithms for Minimization without Derivatives",
  1973, chapter 4): `zeroin` (Brent's root finder by bisection, secant and inverse quadratic
  interpolation), the zero finder of `uniroot` — `src/numerics/integrate.ts`
- netlib fmm (https://netlib.org/fmm/fmin.f; Brent, "Algorithms for Minimization without Derivatives",
  1973, chapter 5): `fmin` (Brent's localmin, golden-section search with parabolic interpolation),
  the minimiser of `optimize` — `src/optim/localmin.ts`
- QUADPACK (Piessens, de Doncker-Kapenga, Überhuber, Kahaner 1983): `dqagse` and `dqagie` (adaptive
  Gauss–Kronrod quadrature with extrapolation), behind `integrate` — `src/integrate/quadpack.ts`,
  ported from SciPy's C translation (see SciPy above)

---

## Published methods (implemented from the papers, no code copied)

Listed for attribution; no license terms apply to the methods themselves.

- N. M. Temme, "Incomplete Laplace integrals: uniform asymptotic expansion with application to the
  incomplete beta function", SIAM J. Math. Anal. 18 (1987) 1638–1663, and Temme, "Special Functions: An
  Introduction to the Classical Functions of Mathematical Physics" (Wiley, 1996), §11.3.3: the uniform
  asymptotic expansion of the incomplete beta function for large a and b, with coefficients generated at run
  time — `src/special/incbetTemme.ts`
