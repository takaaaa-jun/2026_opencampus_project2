# ふりおろしの判定過程を可視化する

## 親issue

[動作解説コンポーネントの実装ガイド](../explanation-panel-common-issue.md)

## 現在の判定

`actions.swing` は、両手首が下方向へ大きく移動したときに `true` になる。

使うPoseランドマークは左手首15と右手首16である。各フレームで両手首の`y`座標の平均を計算し、15フレーム分の履歴を保持する。

```text
handsHeight = (leftWrist.y + rightWrist.y) / 2
top    = 履歴の0〜2番目の平均
middle = 履歴の6〜8番目の平均
foot   = 履歴の12〜14番目の平均
```

画像座標では下へ動くほど`y`が大きくなる。次の条件をすべて満たすと最終判定が `true` になる。

- `top < middle < foot`
- `foot - top >= 0.1`

## 実装すること

- `SwingExplanation` に、両手首と15フレームの高さ履歴を使う説明を表示する。
- 過去・中間・現在の3つの平均値と、下方向への移動量を表示する。
- `actionDetails.swing` に、`handsHeight`、`top`、`middle`、`foot`、`foot - top`、各条件の真偽を追加する。

## 受け入れ条件

- [ ] 両手首の平均高さと、時間による変化を確認できる。
- [ ] `top < middle < foot` と移動量0.1以上の条件を表示できる。
- [ ] 履歴が15フレーム未満のときは判定できないことを表示できる。
- [ ] 実機で `actions.swing` の判定と説明表示が一致する。
