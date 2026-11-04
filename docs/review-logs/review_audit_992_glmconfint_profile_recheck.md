# Audit #992 — glmConfint の profile bracket・Rao/LRT 境界を再確認

- 対象: `src/models/glmConfint.ts`
- 監査時 HEAD: `d322bc6660c78ec07f49a645dc615f7da5101906`
- 対象ソース blob: `9c0759d5a3124bef063030c5be76ae47c4cd869c`
- 判定: 今回確認した範囲で新規不具合なし
- 関連既存Issue: #179（tiny confidence levelでの区間崩壊。現行コードは小level専用の逆profile補間を実装）

## 確認内容

aliased coefficient の除外とNaN区間、full fit の係数収束、restricted fit のoffset移動、LRT deviance差とRao score、profile未収束時のNaN伝播、標準誤差単位でのbracket doubling、Brent root solve、levelが非常に小さい場合のcSmall近似と5点補間を確認。

Rao scoreではfull designを使い、restricted fitのworking residualsがnuisance columnsに直交する性質を利用している。interceptなしのrestricted modelでは中心化しない分岐となる。profile root探索時にrestricted fitが未収束なら誤ったdevianceからrootを返さずNaNとする経路も確認。

## 検証範囲・制約

- `src/models/glmConfint.ts`、`src/models/glm.ts`、`src/internal/uniroot.ts`、`test/glmConfint.test.ts` を確認。
- Issue #179 と現行のtiny-level処理を照合。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし.