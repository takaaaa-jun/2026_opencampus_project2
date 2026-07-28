# アプリケーション設計

## 通信方式

バックエンドからフロントエンドへ、カメラ映像・骨格映像・検知データをWebRTCで送信する。
カメラ映像と骨格映像はWebRTCの映像ストリームで送り、骨格座標・動作判定・途中値はWebRTCのDataChannelで送る。

## バックエンド

### DataChannelメッセージ全体

バックエンドは、解析フレームごとに次のJSONをDataChannelでフロントエンドへ送る。
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
    "surprise": false,
    "kick": false,
    "upper": false,
    "swing": false,
    "closs": false,
    "clap": true,
    "grab": false,
    "kamehameha": false,
    "kamehameha_continue": false
  },
  "actionDetails": {
    "jump": {},
    "sit": {},
    "tpose": {},
    "surprise": {},
    "kick": {},
    "upper": {},
    "swing": {},
    "closs": {},
    "clap": {
      "middleFingertipDistance": 0.06,
      "threshold": 0.1
    },
    "grab": {},
    "kamehameha": {},
    "kamehameha_continue": {}
  }
}
```

### DataChannelで送る検知データ

バックエンドは、MediaPipeの検知結果を解析フレームごとにDataChannelでフロントエンドへ送る。

#### 座標データ

- Pose・Handsの座標値、配列順、要素数はMediaPipeの出力をそのまま使用する。座標の加工や座標系の変換は行わない。
- `pose_results` と `hands_results` はPythonのMediaPipeオブジェクトであるため、送信時には各ランドマークの値をJSONの辞書・配列へ変換する。この変換では値を変更しない。
- `pose` は全身を検知できた場合に含める。検知できない場合は `null` とする。
- `pose.landmarks` は、MediaPipe Poseが返す順序の33要素の配列とする。
- 各Poseランドマークには `x`、`y`、`z`、`visibility` を含める。
- `hands` は検知した手の配列とする。手を検知できない場合は空配列とする。
- `hands[].landmarks` は、MediaPipe Handsが返す順序の21要素の配列とする。
- 各Handランドマークには `x`、`y`、`z` を含める。
- `hands[].handedness` には `left` または `right` を設定する。

#### 動作判定

- `actions` は、動作IDをキー、最終判定を真偽値とするオブジェクトである。
- `actionDetails` は、右側の解説表示に使う途中値を動作IDごとに保持するオブジェクトである。
- `actions` と `actionDetails` は、Pose・Handsの座標と同じ解析フレームの値を送る。
- `actionDetails` の項目は動作ごとに異なる。距離、角度、維持時間、過去フレームの座標などを含める。

## フロントエンド

バックエンドとのWebRTC通信は、ReactのカスタムHookである `useWebRTC` に切り出す。

- `useWebRTC` は、WebRTC接続、映像ストリームの受信、DataChannelメッセージの受信を担当する。
- `useWebRTC` は、カメラ映像ストリーム、骨格映像ストリーム、最新の検知データを返す。
- `App.tsx` は `useWebRTC` を呼び出し、Hookから返された値を画面の各コンポーネントへpropsとして渡す。
- WebRTCの接続処理やメッセージ受信処理は `App.tsx` に直接実装しない。

### コンポーネント木

```text
App
├─ useWebRTC()                         # WebRTC通信と受信データの管理
├─ VideoPanel
│  ├─ CameraVideo                       # カメラ映像を表示
│  └─ SkeletonVideo                     # 骨格映像を表示
└─ ExplanationPanel                     # 選択中の項目を解説
   ├─ ExplanationSelector               # 解説する項目を選択
   └─ ExplanationDetails                # 選択中の説明を表示
      └─ 個別の説明コンポーネント
```

- `App` は `useWebRTC` から受信した映像ストリームと検知データを、`VideoPanel` と `ExplanationPanel` へ渡す。
- `VideoPanel` は映像表示だけを担当する。
- `ExplanationPanel` は選択中の説明IDを状態として持ち、`ExplanationSelector` の選択結果を `ExplanationDetails` へ渡す。
- `ExplanationDetails` は、説明IDに応じた個別の説明コンポーネントを表示する。
- `useWebRTC` が返した検知データは、`App` から各下位コンポーネントへ加工せずそのまま渡す。
- 個別の説明コンポーネントは、受け取った検知データ全体から必要な値を自分で読み取り、それぞれの説明を表示する。
