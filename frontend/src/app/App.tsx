import { useState } from 'react';
import { MotionTabs, type MotionKey } from '../components/explanation/MotionTabs';
import { Clap } from '../components/explanation/details/Clap';
import { PlaceholderDetails } from '../components/explanation/details/Placeholder';

const motionMeta: Record<MotionKey, { title: string; subtitle: string; lead: string }> = {
  clap: {
    title: '拍手',
    subtitle: '両手の中指先端の距離を見て、近づいた瞬間に反応します。',
    lead: '拍手の反応を読み取る Live demo。カメラ映像そのままと、骨格を重ねた映像を並べて、AI が見ている場所をひと目で分かるようにしています。',
  },
  next: {
    title: '次の動き',
    subtitle: 'ここに別の動きの説明とUIを追加できます。',
    lead: '次の動作を追加するときのためのプレースホルダーです。',
  },
  extra: {
    title: 'さらに追加',
    subtitle: '新しい動作を足すときの拡張用ページです。',
    lead: '動作が増えても、ここから同じ構成で広げられます。',
  },
};

export default function App() {
  const [motion, setMotion] = useState<MotionKey>('clap');

  return (
    <main className="page-shell page-shell--single-column">
      <header className="page-header panel">
        <div className="page-header__copy">
          <p className="hero__eyebrow">React + MediaPipe Tasks Vision</p>
          <h1>AIが動きを読み取るデモ</h1>
          <p className="page-header__text">
            カメラに映る手や体の動きを AI がその場で読み取り、骨格の重ね表示と判定の根拠を一緒に見せます。
          </p>
        </div>
      </header>

      <section className="motion-strip panel">
        <MotionTabs value={motion} onChange={setMotion} />
        <div className="motion-strip__body">
          <p className="motion-strip__label">Live demo</p>
          <h2 className="motion-strip__headline">{motionMeta[motion].title}</h2>
          <p className="motion-strip__text">
            {motionMeta[motion].lead} {motionMeta[motion].subtitle}
          </p>
        </div>
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
