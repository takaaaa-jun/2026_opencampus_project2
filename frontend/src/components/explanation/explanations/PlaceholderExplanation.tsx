type Props = {
  title: string;
};

export const PlaceholderExplanation = ({ title }: Props) => (
  <div className="explanation-card__body">
    <p className="explanation-card__lead">{title} の説明をここに追加できます。</p>
    <p className="explanation-card__muted">
      新しい動作を増やすときは、このフォルダに個別コンポーネントを追加していくと整理しやすいです。
    </p>
  </div>
);
