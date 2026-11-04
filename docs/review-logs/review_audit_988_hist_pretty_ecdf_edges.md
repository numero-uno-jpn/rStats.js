# Audit #988 — hist / pretty / ecdf の境界条件を再確認

- 対象: `src/descriptive/hist.ts`
- 監査時 HEAD: `220e2952e33f07846c6dbe9f6f10905940e73e14`
- 対象ソース blob: `b60c1aaceb351286a99ab8ef005a0019acd0e842`
- 判定: 今回確認した範囲で新規不具合なし

## 確認内容

`pretty()` の有限値抽出、同値範囲、ゼロ近傍、非常に小さい/大きい値、n/minN の切り捨てと検証、breaks の端点拡張と minN 補正を確認。`hist()` は自動/明示 breaks、右閉・左閉、includeLowest、fuzz、範囲外データ、density の幅/積 overflow 経路、空データ・定数データを追跡した。`ecdf()` は空標本、NaN除外、±Infinity、境界値の二分探索を確認。

## 検証範囲・制約

- `src/descriptive/hist.ts` と `test/descriptive.test.ts` を確認。
- hist/pretty 関連Issue検索で今回の制御フローに一致する未解決報告は確認できなかった。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし。
