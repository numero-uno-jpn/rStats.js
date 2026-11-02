# 外部レビュー (51 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (乱数ストリーム・`r2dtable`・シード管理・重み付きサンプリング、乱数と分布関数の整合、negbinomial・gamma・beta)。新しい指摘はない。再確認として挙げられた既報は、今のコード (`a1dfba1`) ですべて直っている (レビュアーの zip `src(3).zip` は 48・50 回目より前のもの)。コードは変えていない。

## 判定

| 項目 | レビュアーの結果 | 今のコード | 対応した回 |
|---|---|---|---|
| SPEC-005 `qgamma(p, 1e145)`、p = 0.75、0.9、0.999 | 9.99999999999979e144 (pgamma 0) | すべて 1e145 (pgamma 0.5) | 50 回目 |
| RNG-003 `setSeed(4); rgeom(1, 1e-309)` | 再現 | 1.7160061001777616e308 | 50 回目 |
| RNG-004 `setSeed(1); rnbinom(1, 1, prob = 1e-309)` | 再現。rgamma1 が無限大の尺度を先に検出し、乱数の消費順序が変わる | 1.5514135657233996e308。尺度が溢れるときは尺度 1 のガンマ乱数を引いてから掛ける | 50 回目 |
| RNG-001 BTPE の Stirling 補正の符号 | 残っている | 直した符号 (`setSeed(439); rbinom(1, 10000, 0.5)` は 4879) | 48 回目 |
| SPEC-001 `pbeta(0.5, 1e308, 1e308)`、`qbeta(同)` | 既報の範囲 | 0.5、0.5 | 45 回目 |
| `r2dtable(1, c(3, 2), c(2, 3))` (`set.seed(1)`) | [[[1, 2], [1, 1]]]、問題なし | 同じ | ― |

レビュアーが問題なしとした範囲: `r2dtable` (1 万組の周辺度数で行和・列和と非負性)、L'Ecuyer-CMRG の `nextRNGStream`・`nextRNGSubStream`、シードの保存・復元 (Mersenne-Twister と L'Ecuyer-CMRG)、重み付き抽出 (Walker の alias 法、退化・極端な偏り・和の溢れ・サブノーマルの重み)、rpois のキャッシュの作り直し、rbinom の qbinom への切り替え、rhyper の近似の分岐、negbinomial の分位点と分布関数の整合

## 外部レビュアーの次の予定

`src/internal/dpq.ts`、`src/internal/discrete.ts`、`src/internal/invert.ts` (多くの分布が共有する基盤)
