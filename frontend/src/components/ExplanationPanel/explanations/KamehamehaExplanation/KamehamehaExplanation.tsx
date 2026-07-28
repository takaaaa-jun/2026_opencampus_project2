import { useState } from 'react'
import type { ExplanationProps } from '../../types'
import './KamehamehaExplanation.css'

type Point = {
  x: number
  y: number
}

type KamehamehaDetails = {
  isHandsAvailable: boolean

  wristDistance: number | null
  wristDistanceThreshold: number

  wristXDistance: number | null
  wristXDistanceThreshold: number

  middleFingerXDistance: number | null
  middleFingerXDistanceThreshold: number

  poseCondition: boolean

  holdDuration: number
  holdDurationThreshold: number
}

type ConditionId =
  | 'wrist-distance'
  | 'wrist-x-distance'
  | 'middle-finger-x-distance'
  | 'hold'

type ConditionDetail = {
  title: string
  summary: string
  code: string
}

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],

  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],

  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],

  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],

  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],

  [0, 17],
]

const CONDITION_DETAILS: Record<
  ConditionId,
  ConditionDetail
> = {
  'wrist-distance': {
    title: '両方の手首座標間の距離が近い',
    summary:
      '両方の手首座標間の2次元距離を計算し，0.05未満かを確認します．',
    code: `first_wrist = first_hand.landmark[0]
second_wrist = second_hand.landmark[0]

wrist_distance = distance(
    first_wrist,
    second_wrist,
)

wrist_distance_condition = (
    wrist_distance < 0.05
)`,
  },

  'wrist-x-distance': {
    title: '両方の手首座標の横ずれが小さい',
    summary:
      '両方の手首座標のx座標差を計算し，0.1未満かを確認します．',
    code: `first_wrist = first_hand.landmark[0]
second_wrist = second_hand.landmark[0]

wrist_x_distance = abs(
    first_wrist.x
    - second_wrist.x
)

wrist_x_distance_condition = (
    wrist_x_distance < 0.1
)`,
  },

  'middle-finger-x-distance': {
    title: '両方の中指先端座標の横ずれが小さい',
    summary:
      '両方の中指先端座標のx座標差を計算し，0.1未満かを確認します．',
    code: `first_middle_fingertip = (
    first_hand.landmark[12]
)

second_middle_fingertip = (
    second_hand.landmark[12]
)

middle_finger_x_distance = abs(
    first_middle_fingertip.x
    - second_middle_fingertip.x
)

middle_finger_x_distance_condition = (
    middle_finger_x_distance < 0.1
)`,
  },

  hold: {
    title: '3つの姿勢条件をすべて満たす',
    summary:
      '手首間距離，手首の横ずれ，中指先端の横ずれの3条件がすべて成立しているかを確認します．',
    code: `pose_condition = (
    wrist_distance < 0.05
    and wrist_x_distance < 0.1
    and middle_finger_x_distance < 0.1
)

if pose_condition:
    kamehameha_pose = True
else:
    kamehameha_pose = False`,
  },
}

function isPoint(value: unknown): value is Point {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false
  }

  const point = value as Record<
    string,
    unknown
  >

  return (
    typeof point.x === 'number' &&
    typeof point.y === 'number'
  )
}

function getKamehamehaDetails(
  detectionData: ExplanationProps['detectionData'],
): KamehamehaDetails | null {
  if (
    detectionData === null ||
    typeof detectionData.actionDetails !==
      'object' ||
    detectionData.actionDetails === null
  ) {
    return null
  }

  const actionDetails =
    detectionData.actionDetails as Record<
      string,
      unknown
    >

  const kamehameha =
    actionDetails.kamehameha

  if (
    typeof kamehameha !== 'object' ||
    kamehameha === null
  ) {
    return null
  }

  const details =
    kamehameha as Record<
      string,
      unknown
    >

  const wristDistance =
    typeof details.wristDistance ===
    'number'
      ? details.wristDistance
      : null

  const wristXDistance =
    typeof details.wristXDistance ===
    'number'
      ? details.wristXDistance
      : null

  const middleFingerXDistance =
    typeof details.middleFingerXDistance ===
    'number'
      ? details.middleFingerXDistance
      : null

  const wristDistanceThreshold =
    typeof details.wristDistanceThreshold ===
    'number'
      ? details.wristDistanceThreshold
      : 0.05

  const wristXDistanceThreshold =
    typeof details.wristXDistanceThreshold ===
    'number'
      ? details.wristXDistanceThreshold
      : 0.1

  const middleFingerXDistanceThreshold =
    typeof details
      .middleFingerXDistanceThreshold ===
    'number'
      ? details.middleFingerXDistanceThreshold
      : 0.1

  const poseCondition =
    typeof details.poseCondition ===
    'boolean'
      ? details.poseCondition
      : wristDistance !== null &&
        wristDistance <
          wristDistanceThreshold &&
        wristXDistance !== null &&
        wristXDistance <
          wristXDistanceThreshold &&
        middleFingerXDistance !== null &&
        middleFingerXDistance <
          middleFingerXDistanceThreshold

  return {
    isHandsAvailable:
      typeof details.isHandsAvailable ===
      'boolean'
        ? details.isHandsAvailable
        : wristDistance !== null &&
          wristXDistance !== null &&
          middleFingerXDistance !== null,

    wristDistance,
    wristDistanceThreshold,

    wristXDistance,
    wristXDistanceThreshold,

    middleFingerXDistance,
    middleFingerXDistanceThreshold,

    poseCondition,

    holdDuration:
      typeof details.holdDuration ===
      'number'
        ? details.holdDuration
        : 0,

    holdDurationThreshold:
      typeof details.holdDurationThreshold ===
      'number'
        ? details.holdDurationThreshold
        : 3,
  }
}

function getTwoHands(
  detectionData: ExplanationProps['detectionData'],
): [
  Array<Point | null>,
  Array<Point | null>,
] | null {
  if (
    detectionData === null ||
    !Array.isArray(detectionData.hands) ||
    detectionData.hands.length < 2
  ) {
    return null
  }

  const firstHand =
    detectionData.hands[0]

  const secondHand =
    detectionData.hands[1]

  if (
    !Array.isArray(firstHand.landmarks) ||
    !Array.isArray(secondHand.landmarks)
  ) {
    return null
  }

  const firstLandmarks =
    firstHand.landmarks.map(
      (landmark: unknown) =>
        isPoint(landmark)
          ? landmark
          : null,
    )

  const secondLandmarks =
    secondHand.landmarks.map(
      (landmark: unknown) =>
        isPoint(landmark)
          ? landmark
          : null,
    )

  if (
    firstLandmarks.length < 21 ||
    secondLandmarks.length < 21
  ) {
    return null
  }

  return [
    firstLandmarks,
    secondLandmarks,
  ]
}

function getActionState(
  detectionData: ExplanationProps['detectionData'],
  actionId:
    | 'kamehameha'
    | 'kamehameha_continue',
) {
  if (
    detectionData === null ||
    typeof detectionData.actions !==
      'object' ||
    detectionData.actions === null
  ) {
    return false
  }

  const actions =
    detectionData.actions as Record<
      string,
      unknown
    >

  return actions[actionId] === true
}

function HandSkeleton({
  landmarks,
  wristPassed,
  middleFingerPassed,
}: {
  landmarks: Array<Point | null>
  wristPassed: boolean
  middleFingerPassed: boolean
}) {
  return (
    <g>
      {HAND_CONNECTIONS.map(
        ([startIndex, endIndex]) => {
          const start =
            landmarks[startIndex]

          const end =
            landmarks[endIndex]

          if (
            start === null ||
            start === undefined ||
            end === null ||
            end === undefined
          ) {
            return null
          }

          return (
            <line
              key={`${startIndex}-${endIndex}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className="kamehameha-explanation__hand-line"
            />
          )
        },
      )}

      {landmarks.map(
        (point, index) => {
          if (point === null) {
            return null
          }

          const isWrist =
            index === 0

          const isMiddleFinger =
            index === 12

          const isTarget =
            isWrist ||
            isMiddleFinger

          const isPassed =
            (isWrist &&
              wristPassed) ||
            (isMiddleFinger &&
              middleFingerPassed)

          const pointClassName = [
            'kamehameha-explanation__hand-point',
            isTarget
              ? 'is-target'
              : '',
            isPassed
              ? 'is-passed'
              : '',
          ]
            .filter(Boolean)
            .join(' ')

          const labelClassName = [
            'kamehameha-explanation__point-label',
            isPassed
              ? 'is-passed'
              : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={
                  isTarget
                    ? 0.025
                    : 0.006
                }
                className={
                  pointClassName
                }
              />

              {isTarget ? (
                <text
                  x={point.x + 0.025}
                  y={point.y - 0.025}
                  className={
                    labelClassName
                  }
                >
                  {isWrist
                    ? '手首'
                    : '中指の先端'}
                </text>
              ) : null}
            </g>
          )
        },
      )}
    </g>
  )
}

function DistanceLabel({
  x,
  y,
  title,
  value,
  passed,
  kind,
}: {
  x: number
  y: number
  title: string
  value: number | null
  passed: boolean
  kind: 'wrist' | 'finger'
}) {
  return (
    <g
      className={[
        'kamehameha-explanation__distance-label',
        kind,
        passed ? 'is-passed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <rect
        x={x - 0.17}
        y={y - 0.038}
        width={0.34}
        height={0.076}
        rx={0.015}
      />

      <text
        x={x}
        y={y + 0.012}
        textAnchor="middle"
      >
        {title}：
        {value !== null
          ? value.toFixed(3)
          : '---'}
      </text>
    </g>
  )
}

function ConditionStep({
  condition,
  passed,
  title,
  value,
  threshold,
  selected,
  onSelect,
}: {
  condition: ConditionId
  passed: boolean
  title: string
  value?: number
  threshold?: number
  selected: boolean
  onSelect: (
    condition: ConditionId,
  ) => void
}) {
  const isHold =
    condition === 'hold'

  const className = [
    passed
      ? 'is-passed'
      : '',
    selected
      ? 'is-selected'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={className}>
      <button
        type="button"
        onClick={() =>
          onSelect(condition)
        }
        aria-pressed={selected}
      >
        <span
          className="kamehameha-explanation__condition-icon"
          aria-hidden="true"
        >
          {passed ? '✓' : '○'}
        </span>

        <span className="kamehameha-explanation__condition-content">
          <strong>{title}</strong>

          {value !== undefined &&
          threshold !== undefined ? (
            <small>
              現在値：
              {value.toFixed(
                isHold
                  ? 2
                  : 3,
              )}
              {isHold
                ? '秒'
                : ''}
              {' ／ '}
              しきい値：
              {threshold.toFixed(
                isHold
                  ? 2
                  : 3,
              )}
              {isHold
                ? '秒以上'
                : '未満'}

              <span
                className={[
                  'kamehameha-explanation__condition-status',
                  passed
                    ? 'is-passed'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {passed
                  ? '✓ 成功'
                  : '条件未成立'}
              </span>
            </small>
          ) : (
            <small>
              データを受信していません

              <span className="kamehameha-explanation__condition-status">
                判定待ち
              </span>
            </small>
          )}
        </span>

        <span
          className="kamehameha-explanation__condition-action"
          aria-hidden="true"
        >
          詳しく見る
        </span>
      </button>
    </li>
  )
}

function ConditionDetailPanel({
  condition,
  onClose,
}: {
  condition: ConditionId
  onClose: () => void
}) {
  const detail =
    CONDITION_DETAILS[condition]

  return (
    <section
      className="kamehameha-explanation__detail"
      aria-label={`${detail.title}の詳細`}
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <div className="kamehameha-explanation__detail-heading">
        <h2>{detail.title}</h2>

        <button
          type="button"
          onClick={onClose}
        >
          閉じる
        </button>
      </div>

      <p className="kamehameha-explanation__detail-summary">
        {detail.summary}
      </p>

      <pre className="kamehameha-explanation__code-example">
        <code>{detail.code}</code>
      </pre>
    </section>
  )
}

export function KamehamehaExplanation({
  detectionData,
}: ExplanationProps) {
  const [
    selectedCondition,
    setSelectedCondition,
  ] = useState<ConditionId | null>(
    null,
  )

  const details =
    getKamehamehaDetails(
      detectionData,
    )

  const hands =
    getTwoHands(detectionData)

  const detected =
    getActionState(
      detectionData,
      'kamehameha',
    )

  const continuing =
    getActionState(
      detectionData,
      'kamehameha_continue',
    )

  const firstWrist =
    hands?.[0][0] ?? null

  const firstMiddleFinger =
    hands?.[0][12] ?? null

  const secondWrist =
    hands?.[1][0] ?? null

  const secondMiddleFinger =
    hands?.[1][12] ?? null

  const wristDistancePassed =
    details?.wristDistance !== null &&
    details?.wristDistance !== undefined &&
    details.wristDistance <
      details.wristDistanceThreshold

  const wristXDistancePassed =
    details?.wristXDistance !== null &&
    details?.wristXDistance !== undefined &&
    details.wristXDistance <
      details.wristXDistanceThreshold

  const middleFingerXDistancePassed =
    details?.middleFingerXDistance !==
      null &&
    details?.middleFingerXDistance !==
      undefined &&
    details.middleFingerXDistance <
      details.middleFingerXDistanceThreshold

  const wristPointPassed =
    wristDistancePassed &&
    wristXDistancePassed

  const allConditionsPassed =
    wristDistancePassed &&
    wristXDistancePassed &&
    middleFingerXDistancePassed

  const holdDuration =
    details?.holdDuration ?? 0

  const holdThreshold =
    details?.holdDurationThreshold ?? 3

  const progress =
    holdThreshold > 0
      ? Math.min(
          (holdDuration /
            holdThreshold) *
            100,
          100,
        )
      : 0

  const wristCenter =
    firstWrist !== null &&
    secondWrist !== null
      ? {
          x:
            (firstWrist.x +
              secondWrist.x) /
            2,
          y:
            (firstWrist.y +
              secondWrist.y) /
            2,
        }
      : null

  const middleFingerCenter =
    firstMiddleFinger !== null &&
    secondMiddleFinger !== null
      ? {
          x:
            (firstMiddleFinger.x +
              secondMiddleFinger.x) /
            2,
          y:
            (firstMiddleFinger.y +
              secondMiddleFinger.y) /
            2,
        }
      : null

  const canVisualize =
    hands !== null &&
    firstWrist !== null &&
    secondWrist !== null &&
    firstMiddleFinger !== null &&
    secondMiddleFinger !== null

  const resultText = detected
    ? 'かめはめ波成功！'
    : continuing
      ? `姿勢を維持しています：${holdDuration.toFixed(2)}秒`
      : allConditionsPassed
        ? 'そのまま3秒間維持してください'
        : hands === null
          ? '両手をカメラに映してください'
          : '3つの距離条件を満たしてください'

  return (
    <section
      className="kamehameha-explanation"
      aria-label="かめはめ波の判定過程"
    >
      <p className="kamehameha-explanation__lead">
        判定には，両手の手首座標と，
        両手の中指先端座標を使用します．
        判定に使用する位置と距離を強調して表示します
      </p>

      <div className="kamehameha-explanation__legend">
        <span>
          <i className="wrist" />
          両手の手首座標
        </span>

        <span>
          <i className="finger" />
          両手の中指先端座標
        </span>

        <span>
          <i className="passed" />
          条件成立
        </span>
      </div>

      <div
        className={[
          'kamehameha-explanation__visualization',
          allConditionsPassed
            ? 'is-passed'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {canVisualize ? (
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="両手の手首座標と中指先端座標の距離"
          >
            <HandSkeleton
              landmarks={hands[0]}
              wristPassed={
                wristPointPassed
              }
              middleFingerPassed={
                middleFingerXDistancePassed
              }
            />

            <HandSkeleton
              landmarks={hands[1]}
              wristPassed={
                wristPointPassed
              }
              middleFingerPassed={
                middleFingerXDistancePassed
              }
            />

            <line
              x1={firstWrist.x}
              y1={firstWrist.y}
              x2={secondWrist.x}
              y2={secondWrist.y}
              className={[
                'kamehameha-explanation__distance-line',
                'wrist',
                wristDistancePassed
                  ? 'is-passed'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />

            <line
              x1={firstMiddleFinger.x}
              y1={firstMiddleFinger.y}
              x2={secondMiddleFinger.x}
              y2={secondMiddleFinger.y}
              className={[
                'kamehameha-explanation__distance-line',
                'finger',
                middleFingerXDistancePassed
                  ? 'is-passed'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />

            {wristCenter !== null ? (
              <>
                <DistanceLabel
                  x={wristCenter.x}
                  y={
                    wristCenter.y -
                    0.06
                  }
                  title="両手首座標間の距離"
                  value={
                    details?.wristDistance ??
                    null
                  }
                  passed={
                    wristDistancePassed
                  }
                  kind="wrist"
                />

                <DistanceLabel
                  x={wristCenter.x}
                  y={
                    wristCenter.y +
                    0.06
                  }
                  title="両手首座標の横ずれ"
                  value={
                    details?.wristXDistance ??
                    null
                  }
                  passed={
                    wristXDistancePassed
                  }
                  kind="wrist"
                />
              </>
            ) : null}

            {middleFingerCenter !==
            null ? (
              <DistanceLabel
                x={
                  middleFingerCenter.x
                }
                y={
                  middleFingerCenter.y -
                  0.06
                }
                title="両中指先端座標の横ずれ"
                value={
                  details
                    ?.middleFingerXDistance ??
                  null
                }
                passed={
                  middleFingerXDistancePassed
                }
                kind="finger"
              />
            ) : null}
          </svg>
        ) : (
          <p className="kamehameha-explanation__waiting">
            両手が映るようにカメラの前に立ってください
          </p>
        )}

        {allConditionsPassed ? (
          <p className="kamehameha-explanation__pose-success">
            ✓ 3つの距離条件に成功
          </p>
        ) : null}
      </div>

      {selectedCondition !== null ? (
        <div
          className="kamehameha-explanation__detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="判定条件の詳細"
          onClick={() =>
            setSelectedCondition(null)
          }
        >
          <ConditionDetailPanel
            condition={
              selectedCondition
            }
            onClose={() =>
              setSelectedCondition(
                null,
              )
            }
          />
        </div>
      ) : null}

      <ol className="kamehameha-explanation__conditions">
        <ConditionStep
          condition="wrist-distance"
          passed={
            wristDistancePassed
          }
          title="両手の手首座標間の距離が近い"
          value={
            details?.wristDistance ??
            undefined
          }
          threshold={
            details
              ?.wristDistanceThreshold
          }
          selected={
            selectedCondition ===
            'wrist-distance'
          }
          onSelect={(condition) =>
            setSelectedCondition(
              (current) =>
                current === condition
                  ? null
                  : condition,
            )
          }
        />

        <ConditionStep
          condition="wrist-x-distance"
          passed={
            wristXDistancePassed
          }
          title="両手の手首座標の横ずれが小さい"
          value={
            details?.wristXDistance ??
            undefined
          }
          threshold={
            details
              ?.wristXDistanceThreshold
          }
          selected={
            selectedCondition ===
            'wrist-x-distance'
          }
          onSelect={(condition) =>
            setSelectedCondition(
              (current) =>
                current === condition
                  ? null
                  : condition,
            )
          }
        />

        <ConditionStep
          condition="middle-finger-x-distance"
          passed={
            middleFingerXDistancePassed
          }
          title="両手の中指先端座標の横ずれが小さい"
          value={
            details
              ?.middleFingerXDistance ??
            undefined
          }
          threshold={
            details
              ?.middleFingerXDistanceThreshold
          }
          selected={
            selectedCondition ===
            'middle-finger-x-distance'
          }
          onSelect={(condition) =>
            setSelectedCondition(
              (current) =>
                current === condition
                  ? null
                  : condition,
            )
          }
        />

        <ConditionStep
          condition="hold"
          passed={detected}
          title="姿勢を3秒間維持する"
          value={holdDuration}
          threshold={holdThreshold}
          selected={
            selectedCondition ===
            'hold'
          }
          onSelect={(condition) =>
            setSelectedCondition(
              (current) =>
                current === condition
                  ? null
                  : condition,
            )
          }
        />
      </ol>

      <div
        className={[
          'kamehameha-explanation__hold',
          continuing
            ? 'is-continuing'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p>
          維持時間：
          {holdDuration.toFixed(2)}
          秒 ／
          {holdThreshold.toFixed(2)}
          秒
        </p>

        <div
          className="kamehameha-explanation__progress"
          aria-label="姿勢維持時間"
        >
          <div
            className="kamehameha-explanation__progress-value"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <p
        className={[
          'kamehameha-explanation__result',
          detected
            ? 'is-triggered'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {resultText}
      </p>
    </section>
  )
}