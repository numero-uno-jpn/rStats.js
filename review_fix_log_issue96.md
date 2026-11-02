# Issue #96 対応ログ: dnbeta の x = 1・b = 1 の log 密度で a + ncp/2 が溢れる

GitHub Issue #96。R も正しくない場合の修正。計画は承認済み。

## 確認 (main `3e7de61`)

`src/distributions/nbeta.ts` の `dnbeta1` は、x = 1・b = 1 で密度 a + λ/2 を返し、log では `Math.log(a + mu)` だった。issue の指摘どおり、和が溢れると log も Infinity になる。

| 呼び出し | 真値 | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|---|
| `dbeta(1, 1.5e308, 1, { ncp: 1.5e308, log: true })` | log(2.25e308) = 710.0071388583824 | −Inf | Infinity | 710.0071388583824 |
| 同、線形 | 2.25e308 (double の範囲外) | | Infinity | Infinity |
| `dbeta(1, 2, 1, { ncp: 3, log: true })` | log 3.5 = 1.252763 | 1.252763 | 同じ | 同じ |

## 修正

log で和が溢れるときだけ、log(a/2 + mu/2) + log 2 にした。和が有限なら以前と同じ式で同じビット。docs (英・日) の「R が失敗する場合」に 1 行。

## テスト

- `test/issue96.test.ts`: 上の log と線形の値、通常の範囲。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2451 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
