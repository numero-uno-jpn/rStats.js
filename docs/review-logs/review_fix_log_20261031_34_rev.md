# Revision of review 34: Hedges' J kept in the lgammaDiff form (K2, where R is wrong)

## Plan
- Intent: check Hedges' J against criterion K2 (R's bits where R is right, the correct value only where R is wrong)
  and record why the current form stays.
- Decision: D14 (session 14, user decision of 2026-11-04, `prep/rbits.md` question 2, recommended option 1: keep it).

## Original decision
- Review 34 (2026-11-01, 2f5ccd7, HEDGES-J-LARGE-DF-CANCELLATION-01, fix A, no user decision):
  J = exp(lgammaDiff(1/2, (df - 1) / 2) - log(df / 2) / 2) for all df, instead of effectsize's `.J`
  exp(lgamma(df / 2) - log(sqrt(df / 2)) - lgamma((df - 1) / 2)), which gave 0.99997 at df = 1e10 and 1.28 at 1e14.

## Gap with the current criteria
- K2 asks for R's bits where R is right; the form changed J for every df, not only at large df.

## Comparison (prep; 81 values of df, exact J from Rmpfr at 400 bits, ulp of the exact value)
| df | effectsize's error | current error |
|---|---|---|
| 1.5 to 9 | 0 to 3 ulp | 0 to 4 ulp |
| 10 to 20 | 3 to 19 ulp | 0 to 2 ulp |
| 21 to 60 | 3 to 244 ulp | 0 to 2 ulp |
| 100 to 1000 | 30 to 2147 ulp | 0 to 3 ulp |
| 1e4 | 15943 ulp (3.5e-12) | 0 |
| 1e5 | 1.5e6 ulp (3e-10) | 2 ulp |
| 1e10 | 2.7e11 ulp (6e-5) | 4 ulp |

- R's form starts to lose accuracy from df about 10 (cancellation of the two lgammas, the error roughly proportional
  to df), so most ordinary samples are in the range where R is wrong.
- Below df 10, R's form would give R's bits only partly even in JS (exp, log and lgamma differ between Windows R and
  V8: 37 of the 81 values; df 1.5 and 2 differ). Fixture (Linux R, 21 hedges cases, df 4 to 78): 5 of 21 values with
  R's bits now, 6 with R's form below df 10.

## Decision (2026-11-04)
- Kept as it is: the range where R is wrong (df >= 10) is K2's "correct value where R is wrong", and R's form below
  df 10 would gain about one fixture value for an extra branch.

## Changes
- None in src, tests or docs (the docs row on Hedges' J at large df stays). R fixtures affected: 0.

## Out of scope (recorded)
- None.
