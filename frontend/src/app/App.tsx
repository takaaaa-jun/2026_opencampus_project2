import { useState } from 'react';
import { MotionTabs, type MotionKey } from '../components/explanation/MotionTabs';
import { Clap } from '../components/explanation/details/Clap';
import { PlaceholderDetails } from '../components/explanation/details/Placeholder';

const motionMeta: Record<MotionKey, { title: string; subtitle: string }> = {
  clap: {
    title: '拍手',
    subtitle: '両手の中指先端の距離を見て、近づいた瞬間に反応します。',
  },
  next: {
    title: '次の動き',
    subtitle: 'ここに別の動きの説明とUIを追加できます。',
  },
  extra: {
    title: 'さらに追加',
    subtitle: '新しい動作を足すときの拡張用ページです。',
  },
};

export default function App() {
  const [motion, setMotion] = useState<MotionKey>('clap');

  return (
    <main className="page-shell page-shell--single-column">
      <header className="page-header panel">
        <div className="page-header__copy">
          <p className="hero__eyebrow">React + MediaPipe Tasks Vision</p>
          <h1>AI が動きを読み取るデモ</h1>
          <p className="page-header__text">
            Choose motion で表示内容を切り替え、Live demo ではカメラ映像そのままと骨格の重ね表示を並べて、
            AI がどこを見ているかをひと目で追えるようにしています。
          </p>
        </div>
      </header>

      <section className="motion-strip panel">
        <MotionTabs value={motion} onChange={setMotion} />
      </section>

      <section className="detail-stage">
        {motion === 'clap' ? (
          <Clap />
        ) : (
          <PlaceholderDetails
            title={motionMeta[motion].title}
            subtitle={motionMeta[motion].subtitle}
          />
        )}
      </section>
    </main>
  );
}
