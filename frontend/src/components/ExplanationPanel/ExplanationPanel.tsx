import { useState, type ComponentType } from 'react'
import { ClapExplanation } from './explanations/ClapExplanation/ClapExplanation'
import { CrossArmsExplanation } from './explanations/CrossArmsExplanation/CrossArmsExplanation'
import { KamehamehaExplanation } from './explanations/KamehamehaExplanation/KamehamehaExplanation'
import { SurpriseExplanation } from './explanations/SurpriseExplanation/SurpriseExplanation'
import { SwingExplanation } from './explanations/SwingExplanation/SwingExplanation'
import { TPoseExplanation } from './explanations/TPoseExplanation/TPoseExplanation'
import { UpperExplanation } from './explanations/UpperExplanation/UpperExplanation'
import type { ExplanationItem, ExplanationProps } from './types'
import './ExplanationPanel.css'

type ExplanationPanelProps = ExplanationProps

const explanationItems = [
  { id: 'tpose', label: '十字架' },
  { id: 'surprise', label: '驚かし' },
  { id: 'upper', label: 'アッパー' },
  { id: 'swing', label: 'ふりおろし' },
  { id: 'closs', label: 'ウルトラマン' },
  { id: 'clap', label: 'たたく' },
  { id: 'kamehameha', label: 'かめはめ波' },
] as const satisfies readonly ExplanationItem[]

type AvailableExplanationId = (typeof explanationItems)[number]['id']

const explanationComponents: Record<AvailableExplanationId, ComponentType<ExplanationProps>> = {
  tpose: TPoseExplanation,
  surprise: SurpriseExplanation,
  upper: UpperExplanation,
  swing: SwingExplanation,
  closs: CrossArmsExplanation,
  clap: ClapExplanation,
  kamehameha: KamehamehaExplanation,
}

export function ExplanationPanel({ detectionData, isCameraStarted }: ExplanationPanelProps) {
  const [selectedExplanationId, setSelectedExplanationId] = useState<AvailableExplanationId>('tpose')
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
      <SelectedExplanation detectionData={detectionData} isCameraStarted={isCameraStarted} />
    </section>
  )
}
