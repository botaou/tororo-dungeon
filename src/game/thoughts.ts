import { ActivityKind, MoodId } from '../types';

interface ThoughtLines {
  idle?: string;
  mining?: string;
  job?: string;
  enemy?: string;
  treasure?: string;
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
    sleepy: '……ちょっとだけ休む',
    happy: '外の空気が気持ちいい！',
    hungry: 'お腹すいたけど気にしない',
    wantsMoney: '稼げる依頼はないかな',
  },
  vivi: {
    idle: 'トロロと一緒なら行く',
    job: 'みんなと一緒がいいな',
    sleepy: 'ねむい……',
    happy: 'たのしいね！',
    hungry: 'なにか食べたいな',
    wantsMoney: '依頼、受けてみようかな',
  },
  haku: {
    idle: '今日は近場がいい',
    job: 'これくらいなら大丈夫かな',
    sleepy: '少し休みたい',
    happy: 'みんな無事でよかった',
    hungry: '先にごはんにしたい',
    wantsMoney: '依頼をこなそうかな',
  },
  mone: {
    idle: '鉱石掘りたい',
    mining: '掘るの楽しい！',
    job: 'これは良い依頼！',
    treasure: 'お宝の匂いがする…',
    sleepy: 'もうちょっとだけ掘ってから寝る',
    happy: 'いいもの見つけた！',
    hungry: 'お腹すいたなあ',
    wantsMoney: 'お金になるものを探そう',
  },
};

export function getBirdThought(defId: string, mood: MoodId, activity: ActivityKind, hasJob: boolean): string {
  const lines = LINES[defId];
  if (!lines) return '…';
  if (hasJob && lines.job) return lines.job;
  if (activity === 'mining' && lines.mining) return lines.mining;
  if (activity === 'enemy' && lines.enemy) return lines.enemy;
  if (activity === 'treasure' && lines.treasure) return lines.treasure;
  if (mood !== 'normal' && lines[mood]) return lines[mood]!;
  return lines.idle ?? '…';
}
