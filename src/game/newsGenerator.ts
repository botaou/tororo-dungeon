import { ActivityLogEntry, NewsArticle, Personality } from '../types';
import { CHARACTERS } from '../data/characters';
import { NEWS_MAX_LINES_PER_ARTICLE } from './config';

// トロロタイムズ(item 84) — turns a day's worth of raw ActivityLogEntry
// sentences (already-rendered Japanese, not structured data — see
// makeLogEntry in useWorldStore.ts) into a handful of newspaper-voice
// headline lines. Two different techniques depending on the kind of event:
//
// 1. Routine, frequently-repeated activities (gathering, selling, napping,
//    ...) get grouped per bird and counted, then rendered through
//    AGGREGATE_PHRASES — a personality-flavored phrase bank, completely
//    replacing the literal log text rather than trying to parse/rephrase
//    it. This is what turns "○○が鉱石を3個持ち帰った" into something like
//    "○○、黙々と採取をこなす(本日3回)" — the request's own example
//    transformation, generalized into a small per-personality table instead
//    of one-off string surgery. Note this counts *occurrences*, not summed
//    item quantities — robust against the log's free-form sentence shapes,
//    at the cost of not reproducing an exact "20匹" style total.
// 2. Rare, singular events (level-ups, recruits, recipe finds, a merchant's
//    arrival, ...) are numerous enough in *kind* that a full personality
//    phrase table for each would be a lot of near-duplicate work for
//    content the player already saw pass through the activity log almost
//    verbatim once. Instead, toHeadlineVoice() does the one mechanical
//    rewrite nearly every one of makeLogEntry's own sentences shares — they
//    almost all start "${bird.name}が..." — into "${bird.name}、..." (the
//    exact same connector swap the request's own example uses), and leaves
//    the rest of the sentence as-is.
const AGGREGATE_PHRASES: Partial<Record<string, Record<Personality, string>>> = {
  gather: {
    vanguard: '素材集めに大活躍',
    clingy: 'せっせと素材を持ち帰る',
    cautious: '黙々と採取をこなす',
    freeSpirit: '気の向くまま素材集め',
  },
  kill: {
    vanguard: '敵をバッタバッタと討伐',
    clingy: '仲間を守って奮戦',
    cautious: '危なげなく討伐成功',
    freeSpirit: '気まぐれに強敵退治',
  },
  sell: {
    vanguard: '売却で街に貢献',
    clingy: 'こつこつ売却',
    cautious: '手堅く売却をこなす',
    freeSpirit: '気ままに商品を売りさばく',
  },
  merchantSell: {
    vanguard: '商人にどんどん売却',
    clingy: '商人に品物をお届け',
    cautious: '商人と手堅く取引',
    freeSpirit: '商人と気ままに商談',
  },
  buyFood: {
    vanguard: 'がっつり食事',
    clingy: 'みんなと仲良くご飯',
    cautious: '静かに食事を済ませる',
    freeSpirit: '気の向くまま食事',
  },
  buyShop: {
    vanguard: '買い物もテキパキ',
    clingy: 'お気に入りをお買い物',
    cautious: '必要な物だけ購入',
    freeSpirit: '気になる物を即購入',
  },
  cosmetic: {
    vanguard: '新しい衣装で気合十分',
    clingy: 'お洒落して嬉しそう',
    cautious: '静かに衣装チェンジ',
    freeSpirit: '気まぐれにお洒落',
  },
  treasure: {
    vanguard: 'お宝発見に沸く',
    clingy: 'お宝を見つけて大喜び',
    cautious: '慎重にお宝を回収',
    freeSpirit: 'ひょっこりお宝発見',
  },
  nap: {
    vanguard: '合間にひと休み',
    clingy: '甘えながらお昼寝',
    cautious: 'いつも通りお昼寝',
    freeSpirit: '気づけばお昼寝',
  },
  play: {
    vanguard: '元気いっぱい遊ぶ',
    clingy: '仲間と遊んで満足そう',
    cautious: 'たまには息抜き',
    freeSpirit: '思いのまま遊び満喫',
  },
  detour: {
    vanguard: '寄り道もパワフルに',
    clingy: 'みんなを気にして寄り道',
    cautious: 'たまには寄り道',
    freeSpirit: 'あちこち寄り道三昧',
  },
  visit: {
    vanguard: '町長室にも元気に顔出し',
    clingy: '町長室で甘える',
    cautious: '町長室をそっと訪問',
    freeSpirit: 'ふらっと町長室へ',
  },
};

const NAME_TO_PERSONALITY: Record<string, Personality> = Object.fromEntries(
  CHARACTERS.map((c) => [c.name, c.personality])
);
const DEFAULT_PERSONALITY: Personality = 'cautious';

function personalityOf(birdName: string): Personality {
  return NAME_TO_PERSONALITY[birdName] ?? DEFAULT_PERSONALITY;
}

function toHeadlineVoice(birdName: string, detail: string): string {
  const prefix = `${birdName}が`;
  if (detail.startsWith(prefix)) return `${birdName}、${detail.slice(prefix.length)}`;
  return detail;
}

interface AggregateGroup {
  birdName: string;
  action: string;
  count: number;
}

// 'YYYY-MM-DD' in local time — the calendar-day boundary this whole feature
// is built around (see useNewsStore's own comment on why real calendar days
// rather than the cosmetic in-game clock).
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function generateNewsArticle(dateKey: string, entries: ActivityLogEntry[]): NewsArticle {
  // entries arrives newest-first (see useNewsStore.collectEntries) —
  // reversed so grouping/picking reads in the day's actual chronological
  // order.
  const chronological = [...entries].reverse();

  const aggregateGroups = new Map<string, AggregateGroup>();
  const singularLines: string[] = [];

  for (const entry of chronological) {
    if (entry.birdName && AGGREGATE_PHRASES[entry.action]) {
      const key = `${entry.birdName}|${entry.action}`;
      const existing = aggregateGroups.get(key);
      if (existing) existing.count += 1;
      else aggregateGroups.set(key, { birdName: entry.birdName, action: entry.action, count: 1 });
    } else if (entry.birdName) {
      singularLines.push(toHeadlineVoice(entry.birdName, entry.detail));
    } else {
      // Town-level event (no specific bird, e.g. a merchant arriving) —
      // kept close to the original wording since there's no name to rewrap.
      singularLines.push(entry.detail);
    }
  }

  const aggregateLines = [...aggregateGroups.values()]
    .sort((a, b) => b.count - a.count)
    .map((g) => {
      const phrase = AGGREGATE_PHRASES[g.action]![personalityOf(g.birdName)];
      const suffix = g.count >= 2 ? `(本日${g.count}回)` : '';
      return `${g.birdName}、${phrase}${suffix}。`;
    });

  const normalizedSingular = singularLines.map((l) => (/[。!]$/.test(l) ? l : `${l}。`));

  const lines = [...aggregateLines, ...normalizedSingular].slice(0, NEWS_MAX_LINES_PER_ARTICLE);
  if (lines.length === 0) {
    lines.push('本日は特に大きな出来事はなかったようです。のんびりとした一日でした。');
  }

  const [, month, day] = dateKey.split('-').map(Number);
  return {
    id: `news_${dateKey}`,
    dateKey,
    generatedAt: Date.now(),
    headline: `トロロタイムズ ${month}月${day}日号`,
    lines,
  };
}
