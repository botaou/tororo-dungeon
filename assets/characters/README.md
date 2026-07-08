# キャラクター画像の追加方法

このフォルダにキャラクターの画像ファイルを置くと、アプリ内で表示されます。

## ファイル名のルール

`src/data/characters.ts` の `id` と同じファイル名にしてください。

| id       | 名前   | ファイル名   |
| -------- | ------ | ------------ |
| `tororo` | トロロ | `tororo.png` |
| `vivi`   | ビビ   | `vivi.png`   |
| `haku`   | ハク   | `haku.png`   |
| `mone`   | モネ   | `mone.png`   |

## 推奨仕様

- 正方形(例: 512x512px)
- 背景透過のPNG
- 顔・上半身が中央に収まる構図(丸型アイコンとして切り抜いて表示されます)

## 登録方法

画像ファイルを置いたら、`src/game/characterImages.ts` の該当行のコメントを外してください。

```ts
export const CHARACTER_IMAGES: Partial<Record<string, ReturnType<typeof require>>> = {
  tororo: require('../../assets/characters/tororo.png'),
  // ...
};
```

画像が未登録のキャラクターは、代わりに絵文字とテーマカラーのアイコンが表示されます。
