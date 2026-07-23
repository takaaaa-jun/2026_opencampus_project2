type Props = {
  title: string;
  subtitle: string;
};

export const PlaceholderDetails = ({ title, subtitle }: Props) => (
  <section className="panel panel--placeholder">
    <header className="panel__header">
      <div>
        <p className="eyebrow">Coming soon</p>
        <h2>{title}</h2>
        <p className="panel__desc">{subtitle}</p>
      </div>
    </header>

    <div className="placeholder-card">
      <p className="explanation-card__lead">
        ここに新しい動きのUIと説明を追加します。選択バーを切り替えると、このエリアの内容が変わります。
      </p>
      <ul className="feature-list">
        <li>それぞれの動きごとに個別の details コンポーネントを追加</li>
        <li>必要なら映像、数値、解説をまとめて表示</li>
        <li>増えても App の構造はそのまま維持</li>
      </ul>
    </div>
  </section>
);
