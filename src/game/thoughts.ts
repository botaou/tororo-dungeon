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
  sleepy?: string;
  happy?: string;
  hungry?: string;
  wantsMoney?: string;
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
    happy: '外の空気が気持ちいい！',
    wantsMoney: '稼げる依頼はないかな',
  },
  vivi: {
    idle: 'トロロと一緒なら行く',
    job: 'みんなと一緒がいいな',
    eating: 'もぐもぐ',
    bathing: 'ぱしゃぱしゃ',
    fishing: 'のんびり釣り中',
    resting: 'ねむい……',
    carrying: 'よいしょ、よいしょ',
    happy: 'たのしいね！',
    wantsMoney: '依頼、受けてみようかな',
  },
  haku: {
    idle: '今日は近場がいい',
    job: 'これくらいなら大丈夫かな',
    eating: '先にごはんにしよう',
    bathing: '静かでいいところ',
    fishing: 'じっと待つのが好き',
    resting: '少し休みたい',
    carrying: '落とさないように気をつけよう',
    happy: 'みんな無事でよかった',
    wantsMoney: '依頼をこなそうかな',
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
    happy: 'いいもの見つけた！',
    wantsMoney: 'お金になるものを探そう',
  },
};

export function getBirdThought(defId: string, mood: MoodId, activity: ActivityKind, hasJob: boolean): string {
  const lines = LINES[defId];
  if (!lines) return '…';
  if (hasJob && lines.job) return lines.job;
  if (activity !== 'idle' && lines[activity]) return lines[activity]!;
  if (mood !== 'normal' && lines[mood]) return lines[mood]!;
  return lines.idle ?? '…';
}
