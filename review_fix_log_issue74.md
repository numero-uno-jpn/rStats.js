# Issue #74 対応ログ: optimize が tol = 0 (と極小の tol) で止まらない

GitHub Issue #74。計画は承認済み。

## 再現 (main `ca02771`)

止まる呼び出しなので、src の複製の `localMin` に評価回数の上限 (超えたら例外) を入れて確かめた。

- `optimize(x => x * x, -1, 1, { tol: 0 })`: 止まらない。a = 5e-324、b = 1e-323、x = u = 5e-324 で、tol1 = √eps |x| + tol/3 が 0 になり、ステップ d が 0 に丸まって区間が変わらない (issue の主張どおり)。区間 [0, 1] も同じ
- tol = 5e-324 でも、tol/3 が 0 に丸まって同じく止まらない。tol = 1e-323 では止まる
- (x − 1)² と |x| は tol = 0 でも止まった (最小点が 0 でない、または |x| の値で決まる)

R 4.5.2 は tol = 0 を "invalid 'tol' value" で拒否する。tol = 5e-324 では R も止まらない (20 秒で timeout)。

## 修正

1. `optimize` (`src/numerics/integrate.ts`): R と同じく tol ≤ 0 を拒否する ("'tol' must be a positive finite number")
2. `localMin` (`src/optim/localmin.ts`): 試す点 u が x と同じ (ステップが丸めで 0) なら、区間をそれ以上縮められないので終える。通常の範囲では tol1 ≥ √eps |x| が x の ulp より大きいので起きず、値は変わらない。optimize が半分の座標で呼ぶ場合にも効く

tol = 5e-324 で R は返らず、rStats.js は値を返すので、docs (英・日) の「R が失敗し rStats.js が値を返す」に 1 行足した。

## テスト

- `test/issue74.test.ts`: tol = 0 は RangeError。tol = 5e-324・1e-323 で x²、(x − 1)²、|x|、区間 [0, 1] の x²、最大化が返り、最適点が真の点の近く (0 の近くでは 1.5e-323 以内)。通常の結果
- 修正前は止まる呼び出しなので、stash での失敗の確認は行っていない (評価回数の上限を入れた複製で、修正後の 15 通りが止まることを先に確かめた)
- 全体テスト `npx vitest run`: 2412 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 記録だけ

- `uniroot` も R は tol = 0 を拒否するが、rStats.js は受け付ける。maxiter で必ず止まるので変えていない
