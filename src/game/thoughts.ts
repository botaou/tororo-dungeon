import { ActivityKind, MoodId } from '../types';

interface ThoughtLines {
  idle?: string;
  mining?: string;
  job?: string;
  enemy?: string;
  treasure?: string;
  eating?: string;
  bathing?: string;
  fishing?: string;
  resting?: string;
  carrying?: string;
  selling?: string;
  buyingGear?: string;
  merchantSelling?: string;
  merchantBuying?: string;
  recovering?: string;
  sleepy?: string;
  happy?: string;
  hungry?: string;
  wantsMoney?: string;
  strolling?: string;
  playing?: string;
  chatting?: string;
  napping?: string;
  visiting?: string;
}

// Flavor lines shown when the player taps a bird — a hint at what it's
// doing and why, not a command menu.
const LINES: Record<string, ThoughtLines> = {
  tororo: {
    idle: '今日は探検したい',
    enemy: 'あそこに敵がいるぞ！',
    treasure: '何か見つけたぞ！',
    eating: 'ごはんちゅう',
    bathing: '水浴び気持ちいい！',
    fishing: '釣れるかな…',
    resting: '……ちょっとだけ休む',
    carrying: 'これを街まで持って帰るぞ！',
    selling: '今日の分を売りに行こう',
    buyingGear: '道具屋で何か買おうかな',
    merchantSelling: '商人にこれを見せてみよう',
    merchantBuying: '商人の品揃え、気になるな',
    recovering: '早く元気にならなきゃ……',
    happy: '外の空気が気持ちいい！',
    wantsMoney: '稼げる依頼はないかな',
    strolling: 'ちょっと寄り道しちゃおう',
    playing: '遊ぶの楽しい！',
    chatting: 'なあなあ、聞いてくれよ！',
    napping: 'すー……すー……(ぐっすり)',
  },
  vivi: {
    idle: 'トロロと一緒なら行く',
    job: 'みんなと一緒がいいな',
    eating: 'もぐもぐ',
    bathing: 'ぱしゃぱしゃ',
    fishing: 'のんびり釣り中',
    resting: 'ねむい……',
    carrying: 'よいしょ、よいしょ',
    selling: 'これ売ったら何を買おうかな',
    buyingGear: '新しいの、似合うかな？',
    merchantSelling: 'これ、高く売れるかな？',
    merchantBuying: '商人さん、何持ってきたのかな',
    recovering: 'いたた……ちょっと休む',
    happy: 'たのしいね！',
    wantsMoney: '依頼、受けてみようかな',
    strolling: 'このお花、かわいい！',
    playing: 'きゃっきゃ！たのしい〜！',
    chatting: 'ねえねえ、聞いて聞いて！',
    napping: 'むにゃむにゃ……',
  },
  haku: {
    idle: '今日は近場がいい',
    job: 'これくらいなら大丈夫かな',
    eating: '先にごはんにしよう',
    bathing: '静かでいいところ',
    fishing: 'じっと待つのが好き',
    resting: '少し休みたい',
    carrying: '落とさないように気をつけよう',
    selling: '貯めたぶん、売っておこう',
    buyingGear: '備えあれば憂いなし',
    merchantSelling: '街のためにもなるし、売っておこう',
    merchantBuying: '必要な物だけ見ておこう',
    recovering: '無理は禁物……ゆっくり治そう',
    happy: 'みんな無事でよかった',
    wantsMoney: '依頼をこなそうかな',
    strolling: '少し遠回りしていこう',
    playing: '静かに過ごすのもいいものだ',
    chatting: 'ちょっとした立ち話も、悪くないですね',
    napping: '……(すやすや)',
  },
  mone: {
    idle: '鉱石掘りたい',
    mining: '掘るの楽しい！',
    job: 'これは良い依頼！',
    treasure: 'お宝の匂いがする…',
    eating: 'お腹いっぱいにする！',
    bathing: 'キラキラした石ないかな',
    fishing: '何か釣れそう！',
    resting: 'もうちょっとだけ掘ってから寝る',
    carrying: 'いっぱい持って帰るぞ！',
    selling: 'いい値がつくといいな！',
    buyingGear: 'いい掘り出し物ないかな',
    merchantSelling: 'これ、高く売れそう！',
    merchantBuying: '掘り出し物、あるかな？',
    recovering: 'むぅ……もうちょっと休む',
    happy: 'いいもの見つけた！',
    wantsMoney: 'お金になるものを探そう',
    strolling: 'キラキラしたもの落ちてないかな',
    playing: '掘り出し物ないかな〜',
    chatting: 'ねえ、面白い話があるんだけど！',
    napping: 'ぐー……ぐー……',
  },
};

// Shown as a floating speech bubble the instant a bird's HP bottoms out,
// before it heads home to recover — deliberately light and a little
// bratty ("tired and heading home to sulk"), never anything heavier.
export const RETREAT_LINES = ['疲れたから帰る〜!', 'もうやーだ。', '飽きた!', 'ぴえん'];

// Ambient "chat" flavor — shown as a speech bubble when two nearby recruited
// birds happen to pause together (see BirdState.chatLine, useWorldStore's
// tick). Deliberately generic/interchangeable (not per-character) since two
// arbitrary birds can be the pair on any given roll.
export const CHAT_LINES = [
  'ねえねえ、今日はどうだった?',
  'それ、いいね!',
  'また今度遊ぼうね',
  'ちょっと一休みしよっか',
  'お腹すいてきたね',
  'この街、好きだなあ',
];

// Shown as an occasional speech bubble while a recruited bird has gone
// without an assigned house for a while (see BirdState.houselessSinceMs,
// game/config.ts's HOUSELESS_SULK_MS, useWorldStore's tick) — same
// light, bratty tone as RETREAT_LINES above, never anything heavier.
export const HOUSELESS_LINES = [
  'はやく家がほしいよ〜',
  'ねえ、まだ家決まらないの?',
  'そろそろお家がほしいなあ',
  'このままじゃ拗ねちゃうぞ〜',
];

// One short line shown in the join announcement when a dormant bird
// actually joins the town (see game/recruitment.ts / RecruitmentModal).
export const RECRUIT_LINES: Record<string, string> = {
  vivi: '街が大きくなってきたね!わたしも仲間に入れて!',
  haku: '少しはお役に立てそうです。よろしくお願いします。',
  tororo: 'ここで会ったのも何かの縁!一緒に行こう!',
  mone: '面白そうな街だね!わたしも混ぜて!',
};

export function getBirdThought(defId: string, mood: MoodId, activity: ActivityKind, hasJob: boolean): string {
  const lines = LINES[defId];
  if (!lines) return '…';
  if (hasJob && lines.job) return lines.job;
  if (activity !== 'idle' && lines[activity]) return lines[activity]!;
  if (mood !== 'normal' && lines[mood]) return lines[mood]!;
  return lines.idle ?? '…';
}
