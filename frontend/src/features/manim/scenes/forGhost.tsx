import {
  Circle,
  Create,
  FadeIn,
  Rectangle,
  Text,
  Write,
} from 'manim-web'
import type { Scene } from 'manim-web'
import type { ManimConstruct } from '../types'

type ForGhostAction = '手を叩く' | 'ジャンプ' | 'しゃがむ'

interface ForGhostConfig {
  action: ForGhostAction
  requiredCount: number
  score: number
}

const ghostConfigs: ForGhostConfig[] = [
  {
    action: '手を叩く',
    requiredCount: 3,
    score: 20,
  },
  {
    action: 'ジャンプ',
    requiredCount: 2,
    score: 15,
  },
  {
    action: 'しゃがむ',
    requiredCount: 3,
    score: 25,
  },
]

export const forGhost: ManimConstruct = async (scene: Scene) => {
  const textScale = 1.3
  const font = (size: number) => Math.round(size * textScale)

  const title = new Text({
    text: 'forおばけ処理',
    fontSize: font(32),
    color: '#f8fafc',
    fontWeight: 700,
  }).moveTo([0, 2.35, 0])

  await scene.play(new Write(title))

  for (const config of ghostConfigs) {
    const code = new Text({
      text: `for文：${config.action}を${config.requiredCount}回行う`,
      fontSize: font(22),
      color: '#cbd5e1',
      fontWeight: 700,
    }).moveTo([0, 1.82, 0])

    const playerArea = new Rectangle({
      width: 1.6,
      height: 2.3,
      color: '#e2e8f0',
      strokeWidth: 3,
      fillOpacity: 0.04,
      center: [-2.75, 0.05, 0],
    })

    const playerHead = new Circle({
      radius: 0.2,
      color: '#f8fafc',
      strokeWidth: 4,
      fillOpacity: 0.15,
      center: [-2.75, 0.45, 0],
    })

    const playerBody = new Rectangle({
      width: 0.22,
      height: 0.7,
      color: '#f8fafc',
      strokeWidth: 3,
      fillOpacity: 0.7,
      center: [-2.75, -0.05, 0],
    })

    const playerLeftLeg = new Rectangle({
      width: 0.13,
      height: 0.5,
      color: '#f8fafc',
      strokeWidth: 3,
      fillOpacity: 0.7,
      center: [-2.95, -0.65, 0],
    })

    const playerRightLeg = new Rectangle({
      width: 0.13,
      height: 0.5,
      color: '#f8fafc',
      strokeWidth: 3,
      fillOpacity: 0.7,
      center: [-2.55, -0.65, 0],
    })

    let playerLeftArm = new Rectangle({
      width: 0.5,
      height: 0.13,
      color: '#38bdf8',
      strokeWidth: 3,
      fillOpacity: 0.75,
      center: [-3.05, 0.05, 0],
    })

    let playerRightArm = new Rectangle({
      width: 0.5,
      height: 0.13,
      color: '#38bdf8',
      strokeWidth: 3,
      fillOpacity: 0.75,
      center: [-2.45, 0.05, 0],
    })

    let playerLeftHand = new Circle({
      radius: 0.13,
      color: '#38bdf8',
      strokeWidth: 3,
      fillOpacity: 0.85,
      center: [-3.35, 0.05, 0],
    })

    let playerRightHand = new Circle({
      radius: 0.13,
      color: '#38bdf8',
      strokeWidth: 3,
      fillOpacity: 0.85,
      center: [-2.15, 0.05, 0],
    })

    const playerLabel = new Text({
      text: 'プレイヤー',
      fontSize: font(18),
      color: '#cbd5e1',
      fontWeight: 700,
    }).moveTo([-2.75, -1.35, 0])

    const actionHint = new Text({
      text: `${config.action}動作`,
      fontSize: font(20),
      color: '#facc15',
      fontWeight: 700,
    }).moveTo([-2.75, -1.65, 0])

    const ghostBody = new Circle({
      radius: 0.85,
      color: '#f8fafc',
      strokeWidth: 5,
      fillOpacity: 0.04,
      center: [0.3, -0.05, 0],
    })

    const ghostFace = new Text({
      text: '👻',
      fontSize: font(54),
      color: '#f8fafc',
    }).moveTo([0.3, -0.05, 0])

    const ghostType = new Text({
      text: 'For おばけ',
      fontSize: font(22),
      color: '#facc15',
      fontWeight: 700,
    }).moveTo([0.3, -1.25, 0])

    const actionLabel = new Text({
      text: `動作：${config.action}`,
      fontSize: font(22),
      color: '#f8fafc',
      fontWeight: 700,
    }).moveTo([2.45, 0.62, 0])

    const requiredLabel = new Text({
      text: `必要回数：${config.requiredCount}回`,
      fontSize: font(22),
      color: '#f8fafc',
      fontWeight: 700,
    }).moveTo([2.45, 0.25, 0])

    let countLabel = new Text({
      text: `現在回数：0 / ${config.requiredCount}`,
      fontSize: font(22),
      color: '#facc15',
      fontWeight: 700,
    }).moveTo([2.45, -0.12, 0])

    const scoreLabel = new Text({
      text: `獲得点数：${config.score}pt`,
      fontSize: font(22),
      color: '#86efac',
      fontWeight: 700,
    }).moveTo([2.45, -0.49, 0])

    let judgeLabel = new Text({
      text: '骨格検知：待機中',
      fontSize: font(22),
      color: '#94a3b8',
      fontWeight: 700,
    }).moveTo([0, -2, 0])

    const boxes = Array.from({ length: config.requiredCount }, (_, index) => {
      return new Rectangle({
        width: 0.55,
        height: 0.45,
        color: '#64748b',
        strokeWidth: 3,
        fillOpacity: 0.08,
        center: [-0.55 + index * 0.65, -2.58, 0],
      })
    })

    const boxLabels = boxes.map((box, index) => {
      return new Text({
        text: `${index + 1}`,
        fontSize: font(18),
        color: '#e2e8f0',
        fontWeight: 700,
      }).moveTo(box)
    })

    await scene.play(
      new FadeIn(code),

      new Create(playerArea),
      new Create(playerHead),
      new Create(playerBody),
      new Create(playerLeftLeg),
      new Create(playerRightLeg),
      new Create(playerLeftArm),
      new Create(playerRightArm),
      new Create(playerLeftHand),
      new Create(playerRightHand),
      new FadeIn(playerLabel),
      new FadeIn(actionHint),

      new Create(ghostBody),
      new FadeIn(ghostFace),
      new FadeIn(ghostType),

      new FadeIn(actionLabel),
      new FadeIn(requiredLabel),
      new FadeIn(countLabel),
      new FadeIn(scoreLabel),
      new FadeIn(judgeLabel),

      ...boxes.map((box) => new Create(box)),
      ...boxLabels.map((label) => new Write(label)),
    )

    await scene.wait(0.1)

    for (let currentCount = 1; currentCount <= config.requiredCount; currentCount += 1) {
      scene.remove(judgeLabel)

      judgeLabel = new Text({
        text: '骨格検知：動作確認中',
        fontSize: font(22),
        color: '#94a3b8',
        fontWeight: 700,
      }).moveTo([0, -2, 0])

      scene.add(judgeLabel)

    if (config.action === '手を叩く') {
      const clapEmoji = new Text({
        text: '👏',
        fontSize: font(64),
        color: '#facc15',
      }).moveTo([-2.75, 0.25, 0])

      const clapEffect = new Text({
        text: 'パン!',
        fontSize: font(30),
        color: '#facc15',
        fontWeight: 700,
      }).moveTo([-2.75, 0.85, 0])

      await scene.play(
        new FadeIn(clapEmoji),
        new FadeIn(clapEffect),
      )

      await scene.wait(0.15)

      scene.remove(clapEmoji)
      scene.remove(clapEffect)
    }

      if (config.action === 'ジャンプ') {
        const jumpEffect = new Text({
          text: 'ジャンプ!',
          fontSize: font(24),
          color: '#facc15',
          fontWeight: 700,
        }).moveTo([-1.55, 0.7, 0])

        const jumpArrow = new Text({
          text: '↑',
          fontSize: font(38),
          color: '#38bdf8',
          fontWeight: 700,
        }).moveTo([-1.55, 0.25, 0])

        await scene.play(
          playerHead.animate.moveTo([-2.75, 0.85, 0]),
          playerBody.animate.moveTo([-2.75, 0.35, 0]),
          playerLeftLeg.animate.moveTo([-2.95, -0.25, 0]),
          playerRightLeg.animate.moveTo([-2.55, -0.25, 0]),
          playerLeftArm.animate.moveTo([-3.05, 0.45, 0]),
          playerRightArm.animate.moveTo([-2.45, 0.45, 0]),
          playerLeftHand.animate.moveTo([-3.35, 0.45, 0]),
          playerRightHand.animate.moveTo([-2.15, 0.45, 0]),
          new FadeIn(jumpEffect),
          new FadeIn(jumpArrow),
        )

        await scene.wait(0.08)

        scene.remove(jumpEffect)
        scene.remove(jumpArrow)

        await scene.play(
          playerHead.animate.moveTo([-2.75, 0.45, 0]),
          playerBody.animate.moveTo([-2.75, -0.05, 0]),
          playerLeftLeg.animate.moveTo([-2.95, -0.65, 0]),
          playerRightLeg.animate.moveTo([-2.55, -0.65, 0]),
          playerLeftArm.animate.moveTo([-3.05, 0.05, 0]),
          playerRightArm.animate.moveTo([-2.45, 0.05, 0]),
          playerLeftHand.animate.moveTo([-3.35, 0.05, 0]),
          playerRightHand.animate.moveTo([-2.15, 0.05, 0]),
        )
      }

      if (config.action === 'しゃがむ') {
        const squatEffect = new Text({
          text: 'しゃがむ!',
          fontSize: font(24),
          color: '#facc15',
          fontWeight: 700,
        }).moveTo([-1.55, 0.55, 0])

        const squatArrow = new Text({
          text: '↓',
          fontSize: font(38),
          color: '#38bdf8',
          fontWeight: 700,
        }).moveTo([-1.55, 0.1, 0])

        await scene.play(
          playerHead.animate.moveTo([-2.75, 0.05, 0]),
          playerBody.animate.moveTo([-2.75, -0.35, 0]),
          playerLeftLeg.animate.moveTo([-3.05, -0.75, 0]),
          playerRightLeg.animate.moveTo([-2.45, -0.75, 0]),
          playerLeftArm.animate.moveTo([-3.05, -0.2, 0]),
          playerRightArm.animate.moveTo([-2.45, -0.2, 0]),
          playerLeftHand.animate.moveTo([-3.35, -0.2, 0]),
          playerRightHand.animate.moveTo([-2.15, -0.2, 0]),
          new FadeIn(squatEffect),
          new FadeIn(squatArrow),
        )

        await scene.wait(0.08)

        scene.remove(squatEffect)
        scene.remove(squatArrow)

        await scene.play(
          playerHead.animate.moveTo([-2.75, 0.45, 0]),
          playerBody.animate.moveTo([-2.75, -0.05, 0]),
          playerLeftLeg.animate.moveTo([-2.95, -0.65, 0]),
          playerRightLeg.animate.moveTo([-2.55, -0.65, 0]),
          playerLeftArm.animate.moveTo([-3.05, 0.05, 0]),
          playerRightArm.animate.moveTo([-2.45, 0.05, 0]),
          playerLeftHand.animate.moveTo([-3.35, 0.05, 0]),
          playerRightHand.animate.moveTo([-2.15, 0.05, 0]),
        )
      }

      /**
       * 動作が終わった直後に成功判定・カウント・ボックスを反映
       */
      scene.remove(judgeLabel)
      scene.remove(countLabel)

      judgeLabel = new Text({
        text: `骨格検知：${config.action} 成功`,
        fontSize: font(22),
        color: '#38bdf8',
        fontWeight: 700,
      }).moveTo([0, -2, 0])

      countLabel = new Text({
        text: `現在回数：${currentCount} / ${config.requiredCount}`,
        fontSize: font(22),
        color: '#facc15',
        fontWeight: 700,
      }).moveTo([2.45, -0.12, 0])

      boxes[currentCount - 1].setColor('#22c55e')
      boxes[currentCount - 1].setFillOpacity(0.35)

      scene.add(judgeLabel)
      scene.add(countLabel)

      /**
       * 成功表示を読めるように少し待つ
       */
      await scene.wait(0.9)
    }

    scene.remove(judgeLabel)

    const clearLabel = new Text({
      text: '必要回数に到達：おばけ撃破',
      fontSize: font(25),
      color: '#86efac',
      fontWeight: 700,
    }).moveTo([0, -2, 0])

    const scoreGetLabel = new Text({
      text: `+${config.score}pt`,
      fontSize: font(38),
      color: '#facc15',
      fontWeight: 700,
    }).moveTo([0.3, 1.0, 0])

    await scene.play(new FadeIn(clearLabel))

    await scene.play(
      ghostBody.animate.scale(0.2),
      ghostFace.animate.scale(0.2),
      ghostType.animate.scale(0.2),
    )

    await scene.play(new FadeIn(scoreGetLabel))
    await scene.wait(0.25)

    scene.clear({ render: false })

    await scene.play(new Write(title))
  }

  const endText = new Text({
    text: 'for処理完了',
    fontSize: font(34),
    color: '#86efac',
    fontWeight: 700,
  }).moveTo([0, 0, 0])

  await scene.play(new FadeIn(endText))
  await scene.wait(1.3)
}