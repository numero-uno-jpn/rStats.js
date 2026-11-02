# Issue #58 対応ログ: lmerContest の極端な大きさの対比

GitHub Issue #58。計画は承認済み。

## 再現 (main `98d768b`、R 4.5.2 + lmerTest)

`tTestOf`・`fTestOf` (`src/models/lmerTest.ts`) は、対比 l (行列 L) をそのまま l'β、l'Vl、g_k = l'J_k l、L V L' に使っていた。l を定数倍しても検定は変わらないはずだが、大きな定数では 2 次形式が溢れ、小さな定数ではアンダーフローした。

`lmerContest` の例のモデル (`y ~ x + (1 | g)`):

| 対比 | 修正前 | 修正後 | R 4.5.2 (lmerTest) |
|---|---|---|---|
| `[0, 1]`、joint: false | t 8.16653584405942、df 7.000000000000003 | 同じ | t 8.16653704251139、df 7.00000103575434 (数値微分) |
| `[0, 1e160]`、joint: false | 推定値 8.5e159、標準誤差 Inf、t 0、df・p NaN | t 8.166535844059418、df 7.0000000000000036、標準誤差 1.0408329997330694e159 | 標準誤差 Inf、t 0、df・p NaN |
| `[0, 1e160]` (joint) | F 0、DenDF・p NaN | F 66.69230769230727 | F 0、DenDF・p NaN |
| `diag(2) × 1e160` (joint) | エラー "the matrix contains NaN or infinite values" | F 47.80384477480228、DenDF 4.081826906452642 | エラー "infinite or missing values in 'x'" |
| `[0, 1e-200]`、joint: false | 標準誤差 0、t・df・p NaN | t 8.166535844059418 | 標準誤差 0、t Inf、df・p NaN |
| `[0, 1e-200]`、`diag(2) × 1e-200` (joint) | 空の表 (階数 0 とみなす) | F 66.69…、47.80… | 空の表、または F Inf・NaN |

## 修正

- `tTestOf`: l の最大の絶対値が 2^−256〜2^256 の外なら (`rangeExponent`)、l と rhs を 2^−k で縮めて計算する。t・df・p は縮めた座標のまま、推定値と標準誤差は最後に 2^k 倍する
- `fTestOf` (lmerContest の同時検定と lmerAnova が使う): L 全体と rhs を 1 つの 2^−k で縮める。全体を一様に縮めるので、L V L' の固有ベクトル、回した対比、F、DenDF は変わらない (行ごとに違う倍率にすると固有ベクトルが変わる)
- 範囲の内側では k = 0 で今と同じ計算。倍率が 2 の冪ならビット単位で同じ結果になる (テストで 2^600 を確かめた)。1e160 などでは、縮めた対比が元と違う数になるので、丸めの範囲 (相対 1e-14 程度) で一致する
- docs (`docs/differences-from-r.md` と `docs/ja/`) の「R が失敗し、rStats.js が値を返す場合」の表に 1 行足した

HANDOFF の残課題「lmer の尺度依存」(応答や説明変数の単位で収束しない、Satterthwaite の自由度など) とは別の、対比の大きさだけの修正。

## テスト

- `test/issue58.test.ts`: t 検定で 2^600 倍 (rhs も) がビット単位で同じ t・df・p、推定値と区間が 2^600 倍。1e160・1e-200 倍が相対 1e-13 で同じ。同時検定で diag(2)、[0, 1]、rhs のある diag(2) を 2^600・1e160・1e-200 倍しても F・DenDF・p・Sum Sq が相対 1e-13 で同じ
- stash で、修正前に 2 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2369 passed / 34 skipped、失敗 3。失敗はすべて実行時間の上限 (`test/distributionProperties.test.ts` の signrank 1307 ms、`test/extremeAccuracy.test.ts` の qf 313 ms と qtukey 1441 ms)。負荷によるもので、2 つのファイルを単独で流すと 145 件すべて通る。`npx tsc --noEmit -p .`: エラーなし
