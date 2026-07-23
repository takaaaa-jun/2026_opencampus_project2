# MediaPipe検知結果をJSONへ変換してDataChannel送信

## 1. 目的

カメラの各解析フレームについて、MediaPipe Pose・Handsの検知結果と動作判定結果を、DataChannelで送信できるJSONへ変換する。

送信するJSON全体の構造は[アプリケーション設計](README.md)に従う。

## 2. 送信するJSON全体

配列内のコメントは要素数を示すためのものであり、実際の送信データにはコメントを含めない。

```jsonc
{
  "pose": {
    "landmarks": [
      { "x": 0.51, "y": 0.12, "z": -0.03, "visibility": 0.99 }
      // MediaPipe Poseの順序で合計33要素
    ]
  },
  "hands": [
    {
      "handedness": "left",
      "landmarks": [
        { "x": 0.42, "y": 0.53, "z": -0.01 }
        // MediaPipe Handsの順序で合計21要素
      ]
    }
    // 検知した手ごとに1要素。最大2要素
  ],
  "actions": {
    "jump": false,
    "sit": false,
    "tpose": false,
    "clap": true,
    "grab": false
  },
  "actionDetails": {
    "jump": {},
    "sit": {},
    "tpose": {},
    "clap": {
      "middleFingertipDistance": 0.06,
      "threshold": 0.1
    },
    "grab": {}
  }
}
```

## 3. 入力と出力

変換処理は次の値を受け取る。

| 入力 | 内容 |
| --- | --- |
| `pose_results` | `pose.process()` が返す全身骨格の検知結果 |
| `hands_results` | `hands.process()` が返す手骨格と左右情報の検知結果 |
| `actions` | 既存の`action()`が作る、動作IDをキー、最終判定を真偽値とする辞書 |
| `action_details` | `action()`が保持する、動作IDをキー、判定に使った途中値を値とする辞書 |

出力は、`json.dumps()`で文字列化できるPythonの辞書とする。

```python
payload = serialize_detection(
    pose_results,
    hands_results,
    actions,
    action_details,
)
```

## 4. Poseの変換

`pose_results.pose_landmarks` が存在する場合、MediaPipe Poseの33ランドマークすべてを順番を変えずに配列へ変換する。

```python
{
    "pose": {
        "landmarks": [
            {
                "x": landmark.x,
                "y": landmark.y,
                "z": landmark.z,
                "visibility": landmark.visibility,
            }
            for landmark in pose_results.pose_landmarks.landmark
        ]
    }
}
```

- 座標値を加工・丸め・座標変換しない。
- 配列の0番から32番はMediaPipe Poseのランドマーク番号に対応する。
- 全身を検知できない場合は `"pose": null` とする。

## 5. Handsの変換

`hands_results.multi_hand_landmarks` の各手について、21ランドマークすべてを順番を変えずに配列へ変換する。

同じ配列番号の `hands_results.multi_handedness` から左右情報を取得し、`left` または `right` として設定する。

```python
{
    "hands": [
        {
            "handedness": handedness.classification[0].label.lower(),
            "landmarks": [
                {
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z,
                }
                for landmark in hand_landmarks.landmark
            ],
        }
        for hand_landmarks, handedness in zip(
            hands_results.multi_hand_landmarks,
            hands_results.multi_handedness,
        )
    ]
}
```

- 手を検知できない場合は `"hands": []` とする。
- 片手だけ検知した場合は1要素、両手を検知した場合は2要素となる。
- `handedness` は、配列順ではなくMediaPipeの左右判定結果を使用する。

## 6. 動作判定の変換

`actions` と `actionDetails` は、動作判定処理が作成した辞書をそのままJSONへ含める。

```python
{
    "actions": actions,
    "actionDetails": action_details,
}
```

- `actions` は、たとえば `{"jump": False, "clap": True}` のように最終判定だけを保持する。
- `actionDetails` は、距離、角度、維持時間、過去フレームの座標など、フロントエンドで解説表示する途中値を保持する。
- 途中値の計算は既存の`action()`で行う。フロントエンドは同じ計算を再実装しない。

## 7. 送信処理

カメラフレームを解析するたびに、次の順序で処理する。

```text
Pose・Handsを検知
  → 動作判定と途中値を計算
  → serialize_detectionでpayloadを作成
  → json.dumps(payload)でJSON文字列に変換
  → detection DataChannelへ送信
```

```python
payload = serialize_detection(
    pose_results,
    hands_results,
    actions,
    action_details,
)

if detection_channel is not None and detection_channel.readyState == "open":
    detection_channel.send(json.dumps(payload))
```

- DataChannelが開いていない場合は送信しない。
- 送信できなかった過去のデータは保存・再送しない。
- 送信する`payload`は、同じ解析フレームから得たPose、Hands、動作判定、途中値だけで構成する。
