import type { ActionId, DetectionMessage } from '../../features/detection/types'

interface ExplanationPanelProps {
  selectedAction: ActionId
  detection: DetectionMessage | null
}

const labels: Record<ActionId, string> = {
  clap: '拍手',
  tpose: 'Tポーズ',
  sit: '着席',
  jump: 'ジャンプ',
  grab: '握る',
}

const descriptions: Record<ActionId, string> = {
  clap:
    '両手の中指先端どうしが近づいた変化を見ます。近いだけでなく、近づいた瞬間を合図として使うので、拍手のタイミングが伝わりやすくなります。',
  tpose:
    '肩と手首の位置を見て、腕を横に大きく広げた姿勢かどうかを見ます。ポーズの違いが分かりやすい動きです。',
  sit:
    'ひざの曲がり方と腰の高さを見て、しゃがむ・座る動きかどうかを見ます。人の姿勢の変化を捉えやすい例です。',
  jump:
    '体全体の高さ変化を見ます。上にふわっと浮く動きが入ると、ジャンプらしさが出ます。',
  grab:
    '手のひらに対して指先がどれくらい縮んでいるかを見ます。指を閉じる動きが、そのまま合図になります。',
}

function formatMetric(value: unknown): string {
  if (value === null || value === undefined) return '--'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function ExplanationPanel({ selectedAction, detection }: ExplanationPanelProps) {
  const action = detection?.actions[selectedAction] ?? null
  const metrics = Object.entries(action?.metrics ?? {})

  return (
    <aside className="panel details-panel">
      <div className="panel-heading panel-heading--details">
        <div>
          <p className="eyebrow">HOW IT READS</p>
          <h2>この動きの見方</h2>
          <p className="panel-copy">
            高校生向けの展示では、専門用語を詰め込みすぎず「何を見て、どう合図にしているか」が伝わる説明がちょうどよいです。
          </p>
        </div>
      </div>

      <div className="details-body">
        <div className="details-card">
          <div className="action-title-row">
            <h3>{labels[selectedAction]}</h3>
            <span className={action?.active ? 'result-badge active' : 'result-badge'}>
              {action?.active ? '検出中' : '待機中'}
            </span>
          </div>

          <p className="description">{descriptions[selectedAction]}</p>

          <div className="confidence-block">
            <div className="confidence-label">
              <span>見込み</span>
              <strong>{Math.round((action?.confidence ?? 0) * 100)}%</strong>
            </div>
            <div className="confidence-track">
              <div className="confidence-fill" style={{ width: `${(action?.confidence ?? 0) * 100}%` }} />
            </div>
          </div>

          <div className="metrics-list">
            {metrics.length === 0 ? (
              <div className="empty-state">解析データが届いたら、根拠となる数値をここに表示します。</div>
            ) : (
              <dl className="metric-grid">
                {metrics.map(([key, value]) => (
                  <div className="metric-row" key={key}>
                    <dt>{key}</dt>
                    <dd>{formatMetric(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="frame-info">
            <span>frame {detection?.frame.id ?? '--'}</span>
            <span>処理 {detection ? `${detection.frame.processingTimeMs.toFixed(1)} ms` : '--'}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
