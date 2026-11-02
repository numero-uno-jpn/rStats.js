# 外部レビュー (53 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (特殊関数の残り、loader、Bessel の級数と反射公式、分布関数の極限)。新しい指摘は SPEC-009・010・011 と DIST-003 の 4 件。SPEC-011 は 47 回目に修正済みで、ほかの 3 件は確定した。ユーザーが計画を承認し、3 件を直した。レビュアーが「残っている」としている SPEC-003・006・007 は 47・52 回目に修正済み、SPEC-008 は記録だけにしたもの (レビュアーの zip `src(3).zip` が古い)。

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| SPEC-009 | `choose(1.5e154, 2)` (rCompatible の有無によらない) | 1.125e308 | Inf | 1.1250000000000002e308 |
| | `choose(1e103, 3)` (追加) | 1.6666666666666668e308 | Inf | 1.6666666666666668e308 |
| | `lchoose(1.5e154, 2)` | 709.31399167782256 | 709.3139916778225 | 同じ |
| SPEC-010 | 内部関数 `bd0dd(0, [1, 0])` | ― | [NaN, 0] (`bd0(0, 1)` は 1) | [1, 0] |
| SPEC-011 | `besselY(MIN, 0)` | −Inf | ― | 修正済み (47 回目): −473.99907342300423 |
| | `besselY(1e-323, 0)` | ― | −473.55780222269897 | 同じ (正しい) |
| DIST-003 | `dinvgamma(1, Inf)` (log) | extraDistr は未導入 | NaN (NaN) | 0 (−Inf) |

補足
- SPEC-009 の正しい値: MPFR に double の 1.5e154 を正確に渡すと (52 回目の方法)、n(n − 1)/2 = 1.12500000000000019477e308。1.1250000000000002e308 の double から 0.09 ulp、1.125e308 の double から 0.91 ulp なので、rStats.js の値が正しく丸めた値。R は n に (n − 1)/2 を掛ける 2 回の丸めで 1 ulp ずれる
- SPEC-011: 1e-323 の double は 2^-1073 (= 2 MIN) で、Y0 = (2/π)(log(2^-1074) + γ) = −473.5578…。レビュアーの −473.5502 は、厳密な 10 進数の 1e-323 で計算したもの (52 回目の 10^308 と同じ)
- SPEC-010 は内部関数で、公開関数からこの入力に届く経路は見つかっていない (レビュアーも同じ判断)

## 原因と修正

- `src/special/choose.ts`: k < 30 で double-double の積が途中で溢れたとき、後始末が普通の積で計算し直し、そこでも溢れていた。`fallingRatioScaled` で、n − j を 2^-s (2^s は abs(n) の近く) で割った double-double の積を作り、ldexp(結果, s k) で戻す。2 の冪の拡大・縮小は厳密。真に溢れる値 (choose(1e200, 2)) は Inf のまま
- `src/special/loader.ts` `bd0dd`: x = 0 なら M (bd0 と同じ極限)
- `src/distributions/invgamma.ts` `dinvgamma1`: alpha = Inf で x > 0 なら 0 (log は −Inf)。0 への点質量の極限で、pinvgamma・qinvgamma (と docs の「無限の形状は極限として扱う」) に揃えた。x ≤ 0 は今までどおり

## テスト

- `test/review53.test.ts`: 4 件 (SPEC-011 は修正済みの確認)。通常の範囲の choose は今と同じ値
- stash で、SPEC-011 を除く 3 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2232 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md` の「R が不正確な場合」の特殊関数: choose のオーバーフローの近くの 1 ulp
- dinvgamma は既存の「無限の形状は極限として扱う」の範囲なので、追記していない
