import { useState, type ComponentType } from 'react'
import { ClapExplanation } from './explanations/ClapExplanation/ClapExplanation'
import { CrossArmsExplanation } from './explanations/CrossArmsExplanation/CrossArmsExplanation'
import { GrabExplanation } from './explanations/GrabExplanation/GrabExplanation'
import { JumpExplanation } from './explanations/JumpExplanation/JumpExplanation'
import { KamehamehaContinueExplanation } from './explanations/KamehamehaContinueExplanation/KamehamehaContinueExplanation'
import { KamehamehaExplanation } from './explanations/KamehamehaExplanation/KamehamehaExplanation'
import { KickExplanation } from './explanations/KickExplanation/KickExplanation'
import { SitExplanation } from './explanations/SitExplanation/SitExplanation'
import { SurpriseExplanation } from './explanations/SurpriseExplanation/SurpriseExplanation'
import { SwingExplanation } from './explanations/SwingExplanation/SwingExplanation'
import { TPoseExplanation } from './explanations/TPoseExplanation/TPoseExplanation'
import { UpperExplanation } from './explanations/UpperExplanation/UpperExplanation'
import type { ExplanationId, ExplanationItem, ExplanationProps } from './types'
import './ExplanationPanel.css'

type ExplanationPanelProps = ExplanationProps

const explanationItems: ExplanationItem[] = [
  { id: 'jump', label: 'ジャンプ' },
  { id: 'sit', label: '座る' },
  { id: 'tpose', label: '十字架' },
  { id: 'surprise', label: '驚かし' },
  { id: 'kick', label: 'キック' },
  { id: 'upper', label: 'アッパー' },
  { id: 'swing', label: 'ふりおろし' },
  { id: 'closs', label: 'ウルトラマン' },
  { id: 'clap', label: 'たたく' },
  { id: 'grab', label: '掴む' },
  { id: 'kamehameha', label: 'かめはめ波' },
  { id: 'kamehameha_continue', label: 'かめはめ波（継続）' },
]

const explanationComponents: Record<ExplanationId, ComponentType<ExplanationProps>> = {
  jump: JumpExplanation,
  sit: SitExplanation,
  tpose: TPoseExplanation,
  surprise: SurpriseExplanation,
  kick: KickExplanation,
  upper: UpperExplanation,
  swing: SwingExplanation,
  closs: CrossArmsExplanation,
  clap: ClapExplanation,
  grab: GrabExplanation,
  kamehameha: KamehamehaExplanation,
  kamehameha_continue: KamehamehaContinueExplanation,
}

export function ExplanationPanel({ detectionData }: ExplanationPanelProps) {
  const [selectedExplanationId, setSelectedExplanationId] = useState<ExplanationId>('jump')
  const SelectedExplanation = explanationComponents[selectedExplanationId]

  return (
    <section className="explanation-panel">
      <div className="explanation-selector" role="tablist" aria-label="解説する動作">
        {explanationItems.map((item) => {
          const isSelected = item.id === selectedExplanationId

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`explanation-selector__button${isSelected ? ' is-selected' : ''}`}
              onClick={() => setSelectedExplanationId(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <SelectedExplanation detectionData={detectionData} />
    </section>
  )
}
