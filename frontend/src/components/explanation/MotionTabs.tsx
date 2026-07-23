import type { ActionId } from '../../features/detection/types'

interface MotionTabsProps {
  selected: ActionId
  onSelect: (action: ActionId) => void
}

const ITEMS: Array<{ id: ActionId; label: string; subtitle: string }> = [
  { id: 'clap', label: '拍手', subtitle: '距離の変化を見る' },
  { id: 'tpose', label: 'Tポーズ', subtitle: '腕の広がりを見る' },
  { id: 'sit', label: '着席', subtitle: '膝の曲がりを見る' },
  { id: 'jump', label: 'ジャンプ', subtitle: '高さの変化を見る' },
  { id: 'grab', label: '握る', subtitle: '指の縮みを見る' },
]

export function MotionTabs({ selected, onSelect }: MotionTabsProps) {
  return (
    <nav className="motion-tabs" aria-label="動作の切り替え">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={selected === item.id ? 'motion-tab selected' : 'motion-tab'}
          onClick={() => onSelect(item.id)}
        >
          <span className="motion-tab-label">{item.label}</span>
          <span className="motion-tab-subtitle">{item.subtitle}</span>
        </button>
      ))}
      <button type="button" className="motion-tab add" disabled>
        <span className="motion-tab-label">＋ 追加予定</span>
        <span className="motion-tab-subtitle">このあと増やせます</span>
      </button>
    </nav>
  )
}
