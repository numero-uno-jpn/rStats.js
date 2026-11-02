# 外部レビュー (60 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (multipleComparisons・dunnett・aovEz・anovaSequential・aovStrata)。4 件 (HTEST-031・032、MOD-003・004) を今のコード (`c2fdc7a`) と R 4.5.2 で確かめた。MOD-003 はレビュアー自身が撤回した。ユーザーが計画を承認し、3 件を直した。

ユーザーの判断:
- HTEST-031: 同順位だけ直す。同順位がなければ dunn.test と同じビット
- HTEST-032: エラー
- MOD-004: 逐次表と同じ F 検定の警告を足す (値は変えない)

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| HTEST-031 | `dunnTest(1:8, 4 群各 2, holm, altp)` | dunn.test 1.4.2: 0.414 に 1、0.828、0.414 | 同じ (dunn.test を再現) | 3 つとも 1 (p.adjust と一致) |
| HTEST-032 | `dunnettTest`・`tukeyTest`・`glhtDunnett`、群内が定数 (1, 1, 2, 2, 3, 3) | TukeyHSD p 0、PMCMRplus <2e-16、glht p 1 (警告 "essentially perfect fit") | 統計量 Inf・p 0。差も 0 の組は NaN | RangeError |
| MOD-003 | `aovEz`、ID `1` と `"1"` | R ではベクトルが文字列にそろい、同じ水準 | 1 人 | 変えない (レビュアーも撤回) |
| MOD-004 | `anova(lm(y ~ x), lm(y ~ x + z))`、y = 1 + x + z が厳密に成り立つ | F 2.6e30、p 4e-16、警告なし | F 8.4e62。lm 由来の "essentially perfect fit" の警告は付いていた | 同じ値に "ANOVA F-tests on an essentially perfect fit are unreliable" を足す |

### HTEST-031 の判断の根拠

dunn.test の調整値は、ドキュメントにあるとおり「停止規則つきで棄却」する前提の値で、単調にしない。これは設計としてそのまま残す。しかし同順位の p 値を比較の順に順位付けるので、同じ p 値に違う値が付き、群のラベルを付け替えると同じ比較の値が変わる。報告値として欠陥なので直した。

停止規則の判定を決めるのは、同順位の組のうち並べた順で最初の位置になる。step-down (holm・hs、昇順) では係数が最大の位置で、そこで止まれば残りも止まる。step-up (hochberg・bh・by、降順) では最初に出会う位置 (係数が最小) で、そこで棄却すれば残りも棄却される。そこで、組の全体にこの位置の順位を付けた。判定は dunn.test と変わらない。レビュアーが挙げていない `hs` にも同じ問題があった。

### HTEST-032 の閾値

厳密に 0 で判定する。groupMoments は double-double で平均と平方和を作るので、群内がすべて同じ値なら平方和は厳密に 0 になる。tTest のような相対的な閾値にすると、分散がごく小さい正当なデータまでエラーにしてしまう (テストで 1 + 2^-52 を含むデータが値を返すことを確かめた)。df = 0 (全群 1 例) は "no residual degrees of freedom" にした (59 回目に記録だけにした tukey・dunnett の全群 1 例の NaN も、これでエラーになる)。

## 修正の内容

- `src/htest/multipleComparisons.ts`
  - `dunnAdjust` の `ranks`: 同順位の組に、組の最初の順位を付ける。dunnTest の JSDoc に書き足した
  - `pooled()`: df = 0 か群内平方和が 0 なら RangeError。dunnettTest・tukeyTest・glhtDunnett が使う
- `src/models/anovaSequential.ts` の `comparisonTable()`: 尺度に使うモデル (残差 df が最小) の rss が、当てはめ値の 2 乗和の 1e-10 倍未満なら警告する (sequentialRows と同じ判定)

## 記録だけ

- MOD-003: R と同じ
- レビュアーが確かめた Dunnett の積分: 比較が 1 群なら 2 標本 t 検定と一致する (各群 2〜100 例で相対 1e-15 程度)。問題なし
- pairwiseTTest (pooled)・onewayTest (等分散) も、群内が定数だと p 0 を返す (R も 0)。今回の対象外 (ユーザー判断の範囲は指摘の 3 関数)

## テスト

- `test/review60.test.ts`: 3 件
  - HTEST-031: R の p.adjust の値と比べる。ラベルを付け替えても値が変わらないこと、同順位がなければ dunn.test の式どおりであることも確かめる
  - HTEST-032: エラーと、分散がごく小さいデータ
  - MOD-004: 警告が付くことと、ふつうの比較には付かないこと
- fixture: `test/mcompDunn.test.ts` で、同順位がある 10 件 (#38〜47) は、dunn.test の組の最初の比較の値を期待値にした (R の出力から作る)。件数も確かめる
- stash で、修正前に 3 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2259 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- 「R が不正確な場合」: dunn.test の同順位の調整値
- Where R fails: anova の比較表で完全適合の警告がない
- 「意味のない入力はエラー」: 群内分散 0 の dunnett・tukey・glht

## 外部レビュアーの次の予定

lm の基盤: 重み付き最小二乗と平方和、QR 分解のランク落ち、強い共線性での係数・標準誤差、predict の信頼区間・予測区間、残差自由度が小さいときの t・F 分布の計算
