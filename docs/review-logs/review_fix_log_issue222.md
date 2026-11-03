# Issue #222 log: gammaScale accepts rate and scale whose product is within 1e-15 of 1

GitHub Issue #222. Session 11, judging of the issues classified C. Verdict: not planned (the same rule as R). No code changed; a test added.

## Plan

- Intent: check R's rule for giving both rate and scale, and compare.
- Method: the issue's pair (rate 1, scale 1 + 4 eps, product 1 + 8.9e-16) and 1 + 8 eps in R 4.5.2's dgamma, pgamma and rgamma and in rStats.js's dgamma and pgamma (`gammaScale` itself is internal: not in src/index.ts).
- Why: the issue asks for R's floating-point policy; if rStats.js already has it, nothing changes.

## Check (main `4c4407e`, R 4.5.2)

| Call | R 4.5.2 | rStats.js |
|---|---|---|
| dgamma(2, 3, rate = 1, scale = 1 + 4 eps) | 0x1.152aaa3bf81c8p-2, warning "specify 'rate' or 'scale' but not both" | 0.2706705664732252 (= 0x1.152aaa3bf81c8p-2) |
| dgamma(2, 3, scale = 1 + 4 eps) | 0x1.152aaa3bf81c8p-2 | 0.2706705664732252 |
| dgamma(2, 3, rate = 1) | 0x1.152aaa3bf81ccp-2 | 0.2706705664732254 |
| pgamma(2, 3, rate = 1, scale = 1 + 4 eps) | value with the same warning | 0.3233235838169361 (as with the scale alone) |
| dgamma(2, 3, rate = 1, scale = 1 + 8 eps) | error "specify 'rate' or 'scale' but not both" | RangeError "rate and scale can both be given only when scale = 1 / rate" |
| rgamma(1, 3, rate = 1, scale = 1 + 8 eps) | the same error | |

R's rule (in dgamma, pgamma, qgamma and rgamma) is: if both are given, abs(rate * scale - 1) < 1e-15 warns and uses the scale; otherwise it stops. `gammaScale` (src/distributions/gamma.ts) applies the same comparison and uses the scale, so values and errors are R's bit for bit. The only difference is that rStats.js does not warn (distribution functions have no warning channel; policy "検定の警告は出さない", no warnings from the htest-style results). The tolerance accepts products that are 1 up to the rounding of 1 / rate, which is why R has it: `rate * (1 / rate)` is not always exactly 1 (for example 49 * (1 / 49) = 0.9999999999999999).

## Fix

- None (not planned). R's documented and implemented rule; changing it would reject pairs that R accepts, including `scale = 1 / rate` written as such for some rates.

## Tests

- `test/issue222.test.ts`: the issue's pair gives the scale-only value (R's bits); 1 + 8 eps throws.

## close comment

Not planned: this is R's rule. R's dgamma, pgamma, qgamma and rgamma accept both rate and scale when abs(rate * scale - 1) < 1e-15, use the scale (with the warning "specify 'rate' or 'scale' but not both"), and stop otherwise. For the issue's pair, R 4.5.2's dgamma(2, 3, rate = 1, scale = 1 + 4 * .Machine$double.eps) is 0x1.152aaa3bf81c8p-2, the value for the scale alone, and rStats.js gives the same 0.2706705664732252; with 1 + 8 eps both throw. The tolerance exists because rate * (1 / rate) is not always exactly 1 in doubles (49 * (1 / 49) = 0.9999999999999999), so scale = 1 / rate must be accepted within rounding. rStats.js does not emit the warning (distribution functions have no warning channel). A test was added: test/issue222.test.ts. (Not pushed yet.)
