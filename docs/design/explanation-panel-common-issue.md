# 親issue: 動作解説コンポーネントの実装ガイド

## このissueについて

このissueは，動作ごとの説明コンポーネントを実装するために，現在の構成について把握するためのガイドです．


## 全体のデータの流れ

```text
Pythonバックエンド
  └─ MediaPipeでPose・Handsを検知し、動作を判定する
       ↓ WebRTC DataChannel（JSON）
useWebRTC
  └─ 最新の検知データを detectionData として保持する
       ↓
App
  └─ detectionData を加工せず ExplanationPanel へ渡す
       ↓
ExplanationPanel
  └─ 選択中の動作に対応する説明コンポーネントを表示する
       ↓
{Action}Explanation
  └─ 必要な座標・動作判定・途中値を読み取り、判定過程を可視化する
```

カメラ映像と骨格映像はVideoPanelに表示される。各説明コンポーネントは映像を受け取らず、DataChannelで届く検知データだけを受け取る。

## 現在のコンポーネント構造

```text
frontend/src/
├─ App.tsx
│  └─ useWebRTCから受け取ったdetectionDataをExplanationPanelへ渡す
├─ hooks/
│  └─ useWebRTC.ts                 # WebRTC・DataChannel受信を担当
├─ types/
│  └─ detection.ts                 # 検知データの型
└─ components/
   └─ ExplanationPanel/
      ├─ ExplanationPanel.tsx       # 動作の選択と説明コンポーネントの切替
      ├─ ExplanationPanel.css
      ├─ types.ts                   # ExplanationPropsなどの共通型
      └─ explanations/
         └─ {Action}Explanation/
            ├─ {Action}Explanation.tsx
            └─ {Action}Explanation.css
```

各動作のディレクトリと空のコンポーネントは、すでに作成されている。

## 説明コンポーネントが受け取るもの

すべての説明コンポーネントは、同じpropsを受け取る。

```ts
type ExplanationProps = {
  detectionData: DetectionData | null
}
```

`detectionData` は、バックエンドが送信したDataChannelのJSON全体である。`App` と `ExplanationPanel` は値を加工せず、そのまま渡す。

DataChannelで受信するJSONの全体は次の形式である。コメントは構造の説明用であり、実際のJSONには含まれない。

```jsonc
{
  "pose": {
    "landmarks": [
      { "x": 0.51, "y": 0.12, "z": -0.03, "visibility": 0.99 }
      // MediaPipe Poseの順序で合計33要素
    ]
  },
  // 全身を検知できない場合は pose: null
  "hands": [
    {
      "handedness": "left",
      "landmarks": [
        { "x": 0.42, "y": 0.53, "z": -0.01 }
        // MediaPipe Handsの順序で合計21要素
      ]
    }
    // 検知した手ごとに1要素。最大2要素。未検出時は空配列。
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
    "clap": {},
    "grab": {},
    "kamehameha": {},
    "kamehameha_continue": {}
  }
}
```

座標の順序と値はMediaPipeの出力そのままである。現時点の`actionDetails`はすべて空のオブジェクトである。各sub-issueで判定過程の可視化に途中値が必要になった場合、そのsub-issue内で必要な項目をバックエンドから送るように追加する。

## 担当するsub-issueで行うこと

sub-issueは動作ごとに作成する。たとえば、たたく動作を実装する場合は `ClapExplanation` だけを変更する。

1. 対象動作のsub-issueを読む。
2. `explanations/{Action}Explanation/{Action}Explanation.tsx` を編集する。
3. propsから `detectionData` を受け取り、必要な値を読み取る。
4. その動作の判定に使う骨格点・途中値・しきい値などを可視化する。
5. その動作だけに必要な見た目を `{Action}Explanation.css` に書く。
6. `npm run build` と実機で動作を確認する。

開始時のコンポーネントは空のFragmentを返している。

```tsx
export function ClapExplanation(_props: ExplanationProps) {
  return <></>
}
```

実装時は、必要に応じて次のように`detectionData`を受け取って表示内容を追加する。

```tsx
export function ClapExplanation({ detectionData }: ExplanationProps) {
  if (detectionData === null) {
    return <p>骨格を検出中です。</p>
  }

  return <>{/* たたく動作の判定過程を表示する */}</>
}
```

## 共通の約束

- `App`、`useWebRTC`、`ExplanationPanel` で動作ごとの判定・説明用計算を追加しない。
- 個別の説明コンポーネントは、`detectionData`をpropsとして受け取る。propsの形を動作ごとに変えない。
- 動作固有の表示・スタイルは、対応する動作のディレクトリ内に置く。
- 必要な途中値がDataChannelにない場合は、sub-issueの中でバックエンド側の`actionDetails`追加まで実装する。
- 既存の動作判定ロジックを変更する必要がある場合は、sub-issueで明記する。

## 現在選択できる動作

| 動作ID | 表示名 | 説明コンポーネント |
| --- | --- | --- |
| `jump` | ジャンプ | `JumpExplanation` |
| `sit` | 座る | `SitExplanation` |
| `tpose` | 十字架 | `TPoseExplanation` |
| `surprise` | 驚かし | `SurpriseExplanation` |
| `kick` | キック | `KickExplanation` |
| `upper` | アッパー | `UpperExplanation` |
| `swing` | ふりおろし | `SwingExplanation` |
| `closs` | ウルトラマン | `CrossArmsExplanation` |
| `clap` | たたく | `ClapExplanation` |
| `grab` | 掴む | `GrabExplanation` |
| `kamehameha` | かめはめ波 | `KamehamehaExplanation` |
| `kamehameha_continue` | かめはめ波（継続） | `KamehamehaContinueExplanation` |

## sub-issueの位置づけ

この親issueを読んだ後、担当者は動作ごとのsub-issueに進む。まずは次の6件を作成する。

```text
親issue: 動作解説コンポーネントの実装ガイド
├─ sub-issue: 十字架の判定過程を可視化する
├─ sub-issue: アッパーの判定過程を可視化する
├─ sub-issue: ふりおろしの判定過程を可視化する
├─ sub-issue: ウルトラマンの判定過程を可視化する
├─ sub-issue: たたく動作の判定過程を可視化する
└─ sub-issue: かめはめ波の判定過程を可視化する
```

- [十字架の判定過程を可視化する](sub-issues/tpose-explanation.md)
- [アッパーの判定過程を可視化する](sub-issues/upper-explanation.md)
- [ふりおろしの判定過程を可視化する](sub-issues/swing-explanation.md)
- [ウルトラマンの判定過程を可視化する](sub-issues/closs-explanation.md)
- [たたく動作の判定過程を可視化する](sub-issues/clap-explanation.md)
- [かめはめ波の判定過程を可視化する](sub-issues/kamehameha-explanation.md)
