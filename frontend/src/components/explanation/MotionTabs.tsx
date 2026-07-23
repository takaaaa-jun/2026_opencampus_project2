export type MotionKey = 'clap' | 'next' | 'extra';

type Props = {
  value: MotionKey;
  onChange: (value: MotionKey) => void;
};

const items: Array<{ key: MotionKey; label: string; hint: string }> = [
  { key: 'clap', label: '拍手', hint: '現在のデモ' },
  { key: 'next', label: '次の動き', hint: '追加予定' },
  { key: 'extra', label: 'さらに追加', hint: '拡張用' },
];

export const MotionTabs = ({ value, onChange }: Props) => (
  <div className="motion-tabs" role="tablist" aria-label="motion tabs">
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        role="tab"
        aria-selected={value === item.key}
        className={value === item.key ? 'motion-tab motion-tab--active' : 'motion-tab'}
        onClick={() => onChange(item.key)}
      >
        <span>{item.label}</span>
        <small>{item.hint}</small>
      </button>
    ))}
  </div>
);
