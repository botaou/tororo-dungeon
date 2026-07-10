# 鳥キャラクター 本体スプライト

各鳥の「装備なし基本状態」の本体スプライト(公式イラストを加工したもの)がここに入っており、街のマップ上の表示(`WorldMap`の鳥アイコン)とステータスカード(`BirdRosterModal`)で使われています。`assets/characters/`(丸型の顔アイコン、メニュー等で将来使用)とは別の、2頭身の全身スプライト用のフォルダです。

## フォルダ構成

```
assets/birds/
  tororo/
    base.png   ← 装備なしの基本状態(作成済み)
    walk/      ← 未実装。歩行アニメーション用(将来追加)
    attack/    ← 未実装。攻撃アニメーション用(将来追加)
    back/      ← 未実装。後ろ姿用(将来追加)
  vivi/
    base.png
  haku/
    base.png
  mone/
    base.png
```

`id`(`src/data/characters.ts`の`id`と同じ)ごとにフォルダを分け、その中にファイルを置く。将来のアニメーション・後ろ姿・表情追加は、同じフォルダの下に`walk/`, `attack/`, `back/`などのサブフォルダを増やすだけで拡張できる。

| id       | 名前   | ファイルパス                  |
| -------- | ------ | ----------------------------- |
| `tororo` | トロロ | `assets/birds/tororo/base.png` |
| `vivi`   | ビビ   | `assets/birds/vivi/base.png`   |
| `haku`   | ハク   | `assets/birds/haku/base.png`   |
| `mone`   | モネ   | `assets/birds/mone/base.png`   |

## 技術仕様(本体・装備・将来のアニメーション全フレーム共通)

- **キャンバスサイズ**: 256×256px、背景透過PNG
- **アンカー(基準位置)**: 全ての画像(本体・装備・将来の各アニメーションフレーム)で、キャラクターをキャンバス内の同じ位置に配置すること。目安として、上下左右に約10%ずつの余白を残し、頭上に帽子、手元に武器を重ねられる余地を確保する。
  - この統一ルールにより、本体PNGの上に装備PNGを単純に(0, 0)基準で重ねるだけで正しい位置に表示できる(オフセット計算が不要になる)。
- **作成済みの範囲**: 各鳥の`base.png`(装備なしの基本状態)。4羽とも共通スケール・共通の足裏基準線(y=229px)・水平中央(x≈128px)で配置済み。
- **未作成の範囲**: アニメーション各種、表情集、後ろ姿(いずれも将来のサブフォルダ追加時に、同じキャンバス/アンカー仕様で作成する)。

## 反映済みのデザイン

- ビビ: 顔のオレンジ色を薄めに
- モネ: 赤目
- 全員共通: トサカなし

## 新しいスプライトの登録方法(参考)

`base.png`を差し替えるだけで反映される(`src/game/birdBaseSprites.ts`が`require`済みのため、コード変更は不要)。新しい鳥を追加する場合は、`birdBaseSprites.ts`に該当行を足す:

```ts
export const BIRD_BASE_SPRITES: Partial<Record<string, ReturnType<typeof require>>> = {
  tororo: require('../../assets/birds/tororo/base.png'),
  // ...
};
```

未登録の鳥は、代わりに`assets/characters/`の丸型アイコン→それも未登録なら絵文字、の順にフォールバック表示される(`CharacterAvatar`参照)。
