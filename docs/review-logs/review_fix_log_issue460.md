# Issue #460 log: the slash operator with several terms on the left

GitHub Issue #460. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R is wrong; rStats.js expands as R). No code changed.

## Plan

- Intent: compare the terms of slash formulas on the current main with R's `model.matrix`.
- Why: classified C (the issue says R expands `(a + b)/c` as `a + b + a:c + b:c`).

## Check (main `dfe8bd6`, R 4.5.2)

Column names of `modelMatrix("~ f", d)` and R's `model.matrix(~ f, d)` (numeric a, b, c, d):

| formula | R | rStats.js |
|---|---|---|
| `(a + b) / c` | (Intercept) a b a:b:c | the same |
| `(a+b)/(c+d)` | (Intercept) a b a:b:c a:b:d | the same |
| `(a*b)/c` | (Intercept) a b a:b a:b:c | the same |
| `(a+b:d)/c` | (Intercept) a b:d a:b:d:c | the same |
| `a/b/c` | (Intercept) a a:b a:b:c | the same |

- The issue's `lm("y ~ (a + b) / c", ...)`: R coefficients -2, 2, 1, 0 (a:b:c); rStats.js -2, 2, 1, 2.05e-33 (the same fit up to rounding).
- R defines `a / b` as `a + b %in% a`, where `%in%` crosses b with all the variables of a (for a left side of several terms, all of its variables together; R's model.matrix gives the table above). So `(a + b)/c` is `a + b + a:b:c`, not `a:c + b:c`.

## Earlier decision

- The slash and `%in%` expansion follow R since the model formulas were written (`3004acf`); the R fixture `test/fixtures/modelMatrix.json` has `y ~ (A + B)/C` (columns ... `Aa:Bp:Cu` ...).

## Fix

- None.

## Tests

- None (test/fixtures/modelMatrix.json, `y ~ (A + B)/C`).

## Out of scope

- None.

## close comment

Not planned: rStats.js expands the slash operator as R does. In R, a / b is a + b %in% a, and %in% crosses b with all the variables of the left side, so terms(y ~ (a + b)/c) is a, b, a:b:c (not a:c, b:c); R 4.5.2's model.matrix gives the columns (Intercept), a, b, a:b:c, as rStats.js. (a+b)/(c+d), (a*b)/c, (a+b:d)/c and a/b/c also give the same terms in both, and the R fixture of modelMatrix has y ~ (A + B)/C. (Not pushed yet.)
