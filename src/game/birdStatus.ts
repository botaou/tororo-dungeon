import { BirdState } from '../types';

// Human-readable "現在の状態" for the status card — derived from existing
// activity/hp fields rather than storing redundant new state.
export function getBirdStatusLabel(bird: BirdState): string {
  // hp<=0 shows as "帰宅中" for the brief window before the bird actually
  // reaches home (its activity may still read as whatever it was doing the
  // instant it wore out) — once actually home and topping back up, "療養中".
  if (bird.hp <= 0) return '帰宅中';
  switch (bird.activity) {
    case 'recovering':
      return '療養中';
    case 'enemy':
      return '討伐中';
    case 'mining':
      return '採集中';
    case 'treasure':
      return '探索中';
    case 'carrying':
      return '運搬中';
    case 'selling':
      return '売却中';
    case 'merchantSelling':
      return '商人に売却中';
    case 'merchantBuying':
      return '商人から購入中';
    case 'eating':
      return '購入中';
    case 'resting':
      return '休憩中';
    case 'bathing':
      return '水浴び中';
    case 'fishing':
      return '釣り中';
    case 'idle':
    default:
      return '移動中';
  }
}

// Human-readable "現在の目的" — what the bird is trying to accomplish right
// now, a bit more concrete than the tap-to-see-thought flavor line.
export function getBirdGoalLabel(bird: BirdState): string {
  if (bird.hp <= 0) return '家に戻って回復を待っている';
  if (bird.activity === 'recovering') return '家で療養している';
  if (bird.currentJobId) return '依頼を遂行中';
  switch (bird.targetKind) {
    case 'enemy':
      return '敵と交戦中';
    case 'mining':
      return '採掘へ向かっている';
    case 'treasure':
      return 'お宝を回収中';
    case 'shop':
      if (bird.activity === 'selling') return '素材を売りに向かっている';
      if (bird.activity === 'merchantSelling') return '商人に売りに向かっている';
      if (bird.activity === 'merchantBuying') return '商人の店に向かっている';
      return '餌を買いに向かっている';
    case 'river':
      return '水浴びしている';
    case 'pond':
      return '釣りをしている';
    case 'explore':
      return '探検中';
    case 'rest':
      return '散歩中';
    default:
      return '次の行動を考え中';
  }
}
