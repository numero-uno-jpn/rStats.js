# Revision of issue 30: rbeta with one huge shape kept (an exception to K5)

## Plan
- Intent: record that the issue 30 fix departs from criterion K5 (draw the same uniforms as R) and why it stays.
- Decision: D12 (session 14, user decision of 2026-11-04, `prep/misc.md` question 3, recommended option: add to the
  list of exceptions; no code change).

## Original decision
- Issue 30 (2026-11-02, d3e3952): where 2ab overflows in Cheng's BB algorithm but the smaller shape m is at most 1e32,
  `rbeta` draws G = Gamma(m) and returns G / (G + B) instead of the mean. Owner's decision at the time: fix it (the
  stream departs from R only there; R's output is wrong).

## Gap with the current criteria
- K5: R returns the mean and draws 2 uniforms; rStats.js draws a gamma variate instead, so the stream departs from R
  from that draw on. Beta(1.1, 1e308) has a coefficient of variation of about 0.95, so R's mean
  (`setSeed(12); rbeta(5, 1.1, 1e308)` gives 1.1e-308 five times in R 4.5.2) is not a draw from the distribution.

## Decision (2026-11-04)
- Kept as an exception to K5, like the sign of BTPE's rbinom (review 48). Drawing R's 2 uniforms first would not
  restore R's stream (R draws no gamma variate) and would only change the values; returning R's mean would go back to a
  wrong value (K2). Both shapes huge (such as (1e200, 1e200)) still give 0.5 with R's uniforms.
- Already in the docs ("random streams that differ from R", after BTPE's rbinom).

## Changes
- None in src, tests or docs. R fixtures affected: 0.

## Out of scope (recorded)
- None.
