# トロロ・ダンジョン (prototype)

放置系・スタミナ制ダンジョンゲームのプロトタイプ。Expo (React Native) + TypeScript。

## ゲームループ

1. **スタミナ**: 時間経過で自動回復し（`src/game/config.ts` で調整可）、ステージへの挑戦権として消費する。
2. **ステージ挑戦**: スタミナを消費してステージに入ると、まず一時的な**スキル**を3択から1つ選ぶ（そのステージ中のみ有効、次回はリセット）。
3. **マップ内エナジー**: 時間経過で自動回復し、キャラの召喚に消費する。エナジーがあれば何度でも召喚できる。
4. **自動戦闘**: 召喚したキャラは敵と自動で戦い、倒されたら（HPが尽きたら）マップから消える。撃破した敵は素材をドロップする。
5. **採掘オブジェクト**: タップで即座に素材を獲得（そのステージ内で1回、次に入るとまた採取できる）。
6. **お宝**: タップで高額報酬。ステージごとに生涯1回のみ（一度開けると恒久的に開封済み扱い）。
7. **ステージクリア**: 敵を全滅させるとクリア報酬を獲得し、次のステージが解放される。クリア済みステージにはいつでも戻って周回できる。
8. **永続化**: キャラのステータス・アイテム・素材・ステージ進行は端末に保存（AsyncStorage）。スキル選択は毎回リセット。

## セットアップ(PCで実機のiPhone確認)

Expo Go を使えば、Xcode も Apple Developer 登録も不要でiPhone実機に反映して試せます。

### 事前準備(PC側、1回だけ)

1. **Node.js** をインストール(LTS版。 https://nodejs.org/ )
   - 確認: `node -v` でバージョンが表示されればOK
2. **git** をインストール(https://git-scm.com/ )
3. このリポジトリを clone

   ```bash
   git clone https://github.com/botaou/tororo-dungeon.git
   cd tororo-dungeon
   git checkout claude/idle-dungeon-game-prototype-pj9axt
   ```

4. 依存パッケージをインストール

   ```bash
   npm install
   ```

### 事前準備(iPhone側、1回だけ)

- App Store から **Expo Go** アプリをインストール

### 起動して確認するたび

1. PCとiPhoneを**同じWi-Fi**に接続する
2. PCでプロジェクトフォルダに入り、開発サーバーを起動

   ```bash
   npx expo start
   ```

3. ターミナルにQRコードが表示されるので、iPhoneの**カメラアプリ**でスキャン → 「Expo Goで開く」の通知をタップ
4. Expo Goが起動し、アプリが実機で動きます

コードを変更して保存すると、実機側は自動でリロードされます(Fast Refresh)。確認が終わったらターミナルで `Ctrl+C` して開発サーバーを止めればOKです。

### うまくいかない時

- QRコードが読み取れない/繋がらない → PCとiPhoneが同じWi-Fiか確認。会社・大学のWi-Fiなど端末間通信が制限されたネットワークでは失敗しやすいので、自宅Wi-Fiや共有したスマホのテザリングを試す
- それでも繋がらない → `npx expo start --tunnel` (別ネットワークでも動くが、初回に `@expo/ngrok` の自動インストールを求められます)

## コード構成

```
src/
  types.ts             共有の型定義
  data/                ステージ・キャラ・スキルの静的データ
  game/
    config.ts          スタミナ/エナジー回復速度などの定数
    combat.ts           自動戦闘の1ラウンド解決ロジック（純粋関数）
    useGameClock.ts     1秒間隔のグローバルティック（回復・戦闘の駆動）
  store/
    usePlayerStore.ts   永続化される進行状況（zustand + AsyncStorage）
    useStageStore.ts    ステージ内の一時セッション状態（非永続）
  screens/
    HomeScreen.tsx       スタミナ・ステージ一覧
    StageScreen.tsx       スキル選択・エナジー・召喚・採掘・お宝・戦闘ログ
```

## EAS Build / Submit（iOS / App Store）

このプロトタイプは iOS 向けに EAS Build でビルドし、EAS Submit で App Store Connect に提出できる構成になっています。

### 前提条件

- Apple Developer Program のメンバーシップ
- `eas-cli` をインストールしてログイン: `npm install -g eas-cli && eas login`
- Expo アカウントでプロジェクトを初期化: `eas init`（`app.json` の `extra.eas.projectId` が自動更新されます）

### 置き換えが必要なプレースホルダー

- `app.json` → `expo.ios.bundleIdentifier`: 実際に使う Bundle ID に変更（App Store Connect で登録したものと一致させる）
- `app.json` → `expo.extra.eas.projectId`: `eas init` 実行後に自動で入る値
- `eas.json` → `submit.production.ios`:
  - `appleId`: Apple Developer アカウントのメールアドレス
  - `ascAppId`: App Store Connect 上のアプリの Apple ID（数字）
  - `appleTeamId`: Apple Developer Team ID

`eas submit` はインタラクティブに App Store Connect API キーでの認証も選択できます（`eas.json` に値を埋めずにコマンド実行時のプロンプトに従う方法でも可）。

### ビルド & 提出コマンド

```bash
# シミュレータ確認用ビルド
eas build --platform ios --profile preview

# 本番ビルド（App Store 提出用）
eas build --platform ios --profile production

# App Store Connect (TestFlight) へ提出
eas submit --platform ios --profile production --latest
```

## 今後の拡張候補

- キャラのレベルアップ/装備システム
- ステージのマップをグリッド/2D表現にする
- 敵の複数体同時攻撃や隊列（前衛/後衛）
- プッシュ通知（スタミナ全回復のお知らせ）
