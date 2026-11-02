# 外部レビュー (30 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (gebal、expm の order と非有限値、ノルム、expm の CGS)。

## 判定

| ID | 呼び出し | R 4.5.2 (expm) | 修正前 | 判定 |
|---|---|---|---|---|
| gebal の置換・逆変換 (36) | ― | ― | ― | レビュアーも問題なしと判定 |
| BALANCE-NORM-SUM-OVERFLOW-01 | `expm([[0,1e308],[0,0]])`、`expm([[-1,1e308],[0,-2]])` | [[1,1e308],[0,1]]、2.3254415793482961e307 | 同じ | 誤答の例なし。記録だけ |
| **EXPM-IRRELEVANT-ORDER-VALIDATION-01** (37・40) | `expm([[0,1],[0,0]], method = "Higham08", order = 0)` | [[1,1],[0,1]] | エラー | **修正 (A)** |
| 参考 | `expm(…, method = "Pade", order = 0)` | **単位行列 (誤答)** | エラー | エラーのまま (R は黙って誤る) |
| EXPM-NONFINITE-INPUT-01 (38): 1×1 | `[[NaN]]`、`[[Inf]]` | NaN、Inf | NaN、Inf | exp の値そのもので、R とも一致。対応不要 |
| 〃: 2×2 以上 | `[[Inf,0],[0,1]]`、Pade 法 | (H08b は DGEBAL のエラー) | **NaN の行列を黙って返す** | **修正 (B)** |
| ノルムの累積和 (39) | ― | ― | ― | レビュアーも不具合と判定せず |
| EXPM-CGS-BREAKDOWN-SILENT-01 (41)、EXPM-CGS-RESIDUAL-01 (42) | Pade と Higham08.b を、ランダムな 2000 件 (上三角を最大 1e4 倍した非正規なものを含む) で比較 | ― | 差の最大は相対 2.3e-8 (ノルム 1e6 の非正規な行列) | 破綻の具体例は見つからない。R の expm と同じ CGS の写しで、`[[-1,1e6],[0,-1.000001]]` で R と同じ値。反復の未収束を通知しない設計の 1 つとして、記録だけ |

## A. order の検査

- order を検査するのは、それを使う Pade・PadeO・Taylor・TaylorO のときだけにした。Higham08・Higham08.b は R と同じく無視する
- 4 つの方法では、従来どおり正の整数でなければエラー (R の Pade 法は order = 0 で単位行列を返す誤答)

## B. 非有限値の検査

- 2×2 以上の行列で NaN か無限大を含めば、方法によらず "the matrix contains NaN or infinite values"
  - 修正前、Pade・Taylor 系は NaN の行列を黙って返し、Higham08 系はバランス調整や solve の途中で、別のメッセージで止まっていた
- 1×1 は従来どおり exp の値 (NaN、Inf、−Inf なら 0)。R と同じ

## テスト

- `test/review30.test.ts` を追加した。src を `git stash` で戻すと、2 件とも失敗する
- 全体テスト: 2155 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に、Pade 法の order = 0 (R は単位行列) と非有限値の扱いを書いた
