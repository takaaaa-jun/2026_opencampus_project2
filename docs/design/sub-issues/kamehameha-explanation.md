# かめはめ波の判定過程を可視化する

## 親issue

[動作解説コンポーネントの実装ガイド](../explanation-panel-common-issue.md)

## 現在の判定

かめはめ波は、2本の手を近づけた状態を3秒間維持すると `actions.kamehameha` が `true` になる。

使うHandsランドマークは、左右の手の手首0番と中指先12番である。

まず、次の姿勢条件をすべて満たす必要がある。

```text
wristDistance = 2本の手首0番どうしの2次元距離
wristXDistance = 2本の手首0番どうしのx座標差の絶対値
middleFingerXDistance = 2本の中指先12番どうしのx座標差の絶対値
```

- `wristDistance < 0.05`
- `wristXDistance < 0.1`
- `middleFingerXDistance < 0.1`

姿勢条件を満たしている間、維持時間を計測する。

- `actions.kamehameha_continue`: 姿勢条件を満たしている間 `true`
- `actions.kamehameha`: 姿勢条件を3秒以上維持した後に `true`

条件を外れると維持時間と最終判定はリセットされる。手を2本検出できない場合は判定しない。

## 実装すること

- `KamehamehaExplanation` に、両手の手首0番・中指先12番と、3つの距離条件を表示する。
- 維持時間と、3秒に到達するまでの状態を表示する。
- `actionDetails.kamehameha` に、3つの距離・各しきい値・姿勢条件・維持経過時間を追加する。

## 受け入れ条件

- [ ] 判定に使う手首0番と中指先12番を確認できる。
- [ ] 3つの距離条件と各しきい値を表示できる。
- [ ] 3秒間の維持時間と、判定成立までの状態を表示できる。
- [ ] 条件を外すと維持時間がリセットされることを確認できる。
- [ ] 実機で `actions.kamehameha` の判定と説明表示が一致する。
