// Approximate offline-catchup simulation: given how long the app was
// closed (already capped by the caller), estimates what the recruited
// birds and the town would have gotten up to, without replaying every
// individual tick. Deliberately statistical rather than exact — see
// OFFLINE_TICKS_PER_KILL/OFFLINE_TICKS_PER_GATHER in config.ts, whose
// per-personality values were measured by actually running the real
// stepBird AI solo for 5000 ticks per personality and counting kills/
// gathers (a "vanguard" fights on almost every free tick; a "cautious"
// healer mostly doesn't — a flat rate badly over/under-shoots depending on
// personality, so this is calibrated per-personality instead).
//
// Reuses the same tables the online path uses (ENEMY_DEFS, MINING_NODE_DEFS,
// SECURITY_FEE_RATE) so offline progress stays balance-neutral with
// actually leaving the app open for the same amount of real time — it
// isn't a separate, more generous path.
//
// Deliberately NOT modeled (kept simple, matches the "approximate is fine"
// scope): feed-shop purchases/expense, the merchant's lineup/lifecycle,
// request-board jobs, and per-tick satiety/mood cycling — a bird is just
// assumed to have eaten for free the whole time and settles back near its
// normal baseline mood.

import { ItemId, MaterialId } from '../types';
import { BirdWallet } from '../store/useBirdEconomyStore';
import { CHARACTERS } from '../data/characters';
import { ENEMY_DEFS, MINING_NODE_DEFS } from '../data/world';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import {
  expToNextLevel,
  LEVEL_UP_DEFENSE_GAIN,
  LEVEL_UP_SPEED_GAIN,
  OFFLINE_TICKS_PER_GATHER,
  OFFLINE_TICKS_PER_KILL,
  SECURITY_FEE_RATE,
  STARTING_HAPPINESS,
  STARTING_SATIETY,
  TICK_MS,
  TRAVELER_CHECK_CHANCE,
  TRAVELER_MAX_PURCHASE,
} from './config';

export interface OfflineBirdOutcome {
  defId: string;
  name: string;
  goldGained: number;
  materialsGained: Partial<Record<MaterialId, number>>;
  itemsFound: ItemId[];
  expGained: number;
  levelsGained: number;
  newLevel: number;
  wallet: BirdWallet;
}

export interface OfflineReport {
  realElapsedMs: number; // the true, uncapped gap since the app was last seen
  cappedRealElapsedMs: number; // what actually got simulated
  huntFeeIncome: number; // town's cut of offline combat rewards
  travelerIncome: number; // town's income from offline traveler visits
  townGoldDelta: number; // huntFeeIncome + travelerIncome
  materialsDelta: Partial<Record<MaterialId, number>>; // net change to the town warehouse (traveler purchases only)
  birdOutcomes: OfflineBirdOutcome[];
  highlight: string; // one flavor line picked from whatever stood out, or a generic "quiet" line
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function simulateOfflineProgress(
  realElapsedMs: number,
  cappedRealElapsedMs: number,
  wallets: Record<string, BirdWallet>,
  townMaterials: Record<MaterialId, number>
): OfflineReport {
  const effectiveTicks = Math.floor(cappedRealElapsedMs / TICK_MS);

  let huntFeeIncome = 0;
  const birdOutcomes: OfflineBirdOutcome[] = [];
  const highlights: string[] = [];

  const recruited = CHARACTERS.filter((c) => wallets[c.id]?.isRecruited);

  for (const c of recruited) {
    const wallet = wallets[c.id];

    let goldGained = 0;
    let expGained = 0;
    const materialsGained: Partial<Record<MaterialId, number>> = {};
    const itemsFound: ItemId[] = [];

    const encounters = Math.round(effectiveTicks / OFFLINE_TICKS_PER_KILL[c.personality]);
    for (let i = 0; i < encounters; i++) {
      const enemy = pick(ENEMY_DEFS);
      const totalGold = Math.round(enemy.goldReward * (1 + (c.materialBonusPercent ?? 0) / 100));
      const fee = Math.round(totalGold * SECURITY_FEE_RATE);
      goldGained += totalGold - fee;
      huntFeeIncome += fee;
      expGained += enemy.expReward;
      for (const drop of enemy.dropTable ?? []) {
        if (Math.random() >= drop.chance) continue;
        if (drop.kind === 'material') {
          materialsGained[drop.materialId] = (materialsGained[drop.materialId] ?? 0) + drop.amount;
        } else {
          itemsFound.push(drop.itemId);
        }
      }
    }

    const gathers = Math.round(effectiveTicks / OFFLINE_TICKS_PER_GATHER[c.personality]);
    for (let i = 0; i < gathers; i++) {
      const node = pick(MINING_NODE_DEFS);
      materialsGained[node.resource] = (materialsGained[node.resource] ?? 0) + node.amount;
      for (const drop of node.bonusDropTable ?? []) {
        if (Math.random() >= drop.chance) continue;
        if (drop.kind === 'item') itemsFound.push(drop.itemId);
        else materialsGained[drop.materialId] = (materialsGained[drop.materialId] ?? 0) + drop.amount;
      }
    }

    // Leveling follows the same curve as the online path (grantExp in
    // useWorldStore), applied to the wallet fields that actually persist
    // across sessions — atk/hp aren't tracked in BirdWallet even during
    // normal play (they're rebuilt from the character def each session),
    // so leaving them alone here doesn't regress anything.
    let level = wallet.level;
    let exp = wallet.exp + expGained;
    let levelsGained = 0;
    let defense = wallet.defense;
    let speed = wallet.speed;
    while (exp >= expToNextLevel(level)) {
      exp -= expToNextLevel(level);
      level += 1;
      levelsGained += 1;
      defense += LEVEL_UP_DEFENSE_GAIN;
      speed += LEVEL_UP_SPEED_GAIN;
    }

    const nextInventory = { ...wallet.inventory };
    for (const [materialId, amount] of Object.entries(materialsGained) as [MaterialId, number][]) {
      nextInventory[materialId] = (nextInventory[materialId] ?? 0) + (amount ?? 0);
    }
    const nextItems = { ...wallet.items };
    for (const itemId of itemsFound) {
      nextItems[itemId] = (nextItems[itemId] ?? 0) + 1;
    }

    const updatedWallet: BirdWallet = {
      ...wallet,
      gold: wallet.gold + goldGained,
      inventory: nextInventory,
      items: nextItems,
      level,
      exp,
      defense,
      speed,
      // Free food is always available, so a bird is never actually stuck
      // hungry for a whole offline gap — approximated as "was fine the
      // whole time" rather than modeling every hunger cycle individually.
      satiety: STARTING_SATIETY,
      happiness: Math.round((wallet.happiness + STARTING_HAPPINESS) / 2),
    };

    birdOutcomes.push({
      defId: c.id,
      name: c.name,
      goldGained,
      materialsGained,
      itemsFound,
      expGained,
      levelsGained,
      newLevel: level,
      wallet: updatedWallet,
    });

    if (levelsGained > 0) highlights.push(`${c.name}がLv${level}まで成長していました`);
    if (itemsFound.length > 0) highlights.push(`${c.name}が掘り出し物を見つけていました`);
    if (encounters > 0 && goldGained > 0) highlights.push(`${c.name}が討伐で${goldGained}Gを稼いでいました`);
  }

  // Traveler visits — same odds as the online path (see useWorldStore's
  // tick()), buying straight out of whatever the town happens to have in
  // stock right now.
  let travelerIncome = 0;
  const materialsSnapshot = { ...townMaterials };
  const travelerRolls = Math.round(effectiveTicks * TRAVELER_CHECK_CHANCE);
  for (let i = 0; i < travelerRolls; i++) {
    const owned = (Object.keys(MATERIAL_SELL_PRICE) as MaterialId[]).filter((k) => (materialsSnapshot[k] ?? 0) > 0);
    if (owned.length === 0) continue;
    const materialId = pick(owned);
    const stock = materialsSnapshot[materialId] ?? 0;
    const amount = Math.min(stock, 1 + Math.floor(Math.random() * TRAVELER_MAX_PURCHASE));
    const revenue = amount * MATERIAL_SELL_PRICE[materialId];
    if (amount > 0 && revenue > 0) {
      materialsSnapshot[materialId] = stock - amount;
      travelerIncome += revenue;
    }
  }
  const materialsDelta: Partial<Record<MaterialId, number>> = {};
  for (const materialId of Object.keys(materialsSnapshot) as MaterialId[]) {
    const diff = (materialsSnapshot[materialId] ?? 0) - (townMaterials[materialId] ?? 0);
    if (diff !== 0) materialsDelta[materialId] = diff;
  }
  if (travelerRolls > 0 && travelerIncome > 0) highlights.push(`旅人が街に立ち寄っていきました(+${travelerIncome}G)`);

  const highlight =
    highlights.length > 0 ? pick(highlights) : recruited.length > 0 ? 'みんな、のんびり平和に過ごしていたようです' : '';

  return {
    realElapsedMs,
    cappedRealElapsedMs,
    huntFeeIncome,
    travelerIncome,
    townGoldDelta: huntFeeIncome + travelerIncome,
    materialsDelta,
    birdOutcomes,
    highlight,
  };
}
