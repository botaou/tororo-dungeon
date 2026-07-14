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
//
// Selling to the town's shop IS modeled (see the sell-trip loop below) even
// though mood isn't — otherwise every material a bird gathers offline would
// pile up in that bird's own pocket forever, and the shared town warehouse
// would never grow from a long offline gap the way it does during online
// play (where a free bird periodically walks over and sells its most
// plentiful material). Approximated at the mood-agnostic SELL_CHECK_CHANCE_BASE
// rate (ignoring the higher "wantsMoney" rate, consistent with not modeling
// mood at all) rather than a full per-personality calibration.

import { ItemId, MaterialId } from '../types';
import { BirdWallet } from '../store/useBirdEconomyStore';
import { CHARACTERS } from '../data/characters';
import { ENEMY_DEFS, MINING_NODE_DEFS } from '../data/world';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import {
  BIRD_INVENTORY_CAP,
  expToNextLevel,
  LEVEL_UP_ATK_GAIN,
  LEVEL_UP_DEFENSE_GAIN,
  LEVEL_UP_HP_GAIN,
  LEVEL_UP_SPEED_GAIN,
  OFFLINE_TICKS_PER_GATHER,
  OFFLINE_TICKS_PER_KILL,
  OVERFLOW_SELL_MARGIN,
  OVERFLOW_SELL_MAX_GOLD_PER_TRIP,
  OVERFLOW_SELL_MAX_PER_TRIP,
  SECURITY_FEE_RATE,
  SELL_CHECK_CHANCE_BASE,
  SELL_MAX_GOLD_PER_TRIP,
  SELL_MAX_PER_TRIP,
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
  sellExpense: number; // gold the town spent buying materials birds sold to the shop
  materialsDelta: Partial<Record<MaterialId, number>>; // net change to the town warehouse (bird sales add, traveler purchases remove)
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
  townMaterials: Record<MaterialId, number>,
  playerGold: number
): OfflineReport {
  const effectiveTicks = Math.floor(cappedRealElapsedMs / TICK_MS);

  let huntFeeIncome = 0;
  let sellExpense = 0;
  // Mutated by both the per-bird selling loop below and the traveler loop
  // further down, then diffed against townMaterials at the end — a single
  // running snapshot keeps the two income sources (bird sales add, traveler
  // purchases remove) consistent instead of tracked separately.
  const materialsSnapshot = { ...townMaterials };
  // Capped the same way a single online sale is (SELL_MAX_GOLD_PER_TRIP per
  // trip) and never allowed to go negative, so a long offline gap can't let
  // simulated buying-from-birds outspend what the player actually has.
  let simulatedPlayerGold = playerGold;
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

    // Leveling follows the same curve and gains as the online path
    // (grantExp in useWorldStore) — all 4 growable stats, matching
    // BirdWallet's atk/maxHp/defense/speed fields.
    let level = wallet.level;
    let exp = wallet.exp + expGained;
    let levelsGained = 0;
    let atk = wallet.atk;
    let maxHp = wallet.maxHp;
    let defense = wallet.defense;
    let speed = wallet.speed;
    while (exp >= expToNextLevel(level)) {
      exp -= expToNextLevel(level);
      level += 1;
      levelsGained += 1;
      atk += LEVEL_UP_ATK_GAIN;
      maxHp += LEVEL_UP_HP_GAIN;
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

    // Same "sell the single most-plentiful material" behavior as the
    // online path's pickSellOffer/executeSellTrip, just rolled in bulk over
    // the whole offline gap instead of one tick at a time. Without this,
    // everything gathered offline would stay stuck in the bird's own
    // pocket, and the shared town warehouse (and bird's gold) would never
    // grow the way it does during an equivalent stretch of online play.
    let sellGoldGained = 0;
    const sellTrips = Math.round(effectiveTicks * SELL_CHECK_CHANCE_BASE);
    for (let i = 0; i < sellTrips; i++) {
      let bestId: MaterialId | null = null;
      let bestAmount = 0;
      for (const [materialId, amount] of Object.entries(nextInventory) as [MaterialId, number][]) {
        if ((amount ?? 0) > bestAmount) {
          bestId = materialId;
          bestAmount = amount ?? 0;
        }
      }
      if (!bestId || bestAmount <= 0) break;
      const unitPrice = MATERIAL_SELL_PRICE[bestId];
      const offeredAmount = Math.min(bestAmount, SELL_MAX_PER_TRIP);
      const spendCap = Math.min(simulatedPlayerGold, SELL_MAX_GOLD_PER_TRIP);
      const affordableUnits = unitPrice > 0 ? Math.floor(spendCap / unitPrice) : 0;
      const soldAmount = Math.min(offeredAmount, affordableUnits);
      if (soldAmount <= 0) continue;
      const cost = soldAmount * unitPrice;
      nextInventory[bestId] = bestAmount - soldAmount;
      materialsSnapshot[bestId] = (materialsSnapshot[bestId] ?? 0) + soldAmount;
      simulatedPlayerGold -= cost;
      sellExpense += cost;
      sellGoldGained += cost;
    }

    // Real-device report: a bird came back from a long offline gap sitting
    // on ~1500 units of one material — the casual trickle-sale loop above
    // (fixed trip count, small per-trip caps) never checks
    // BIRD_INVENTORY_CAP at all, unlike the online path (see ai.ts's
    // executeSellTrip), so hours of uninterrupted gathering could far
    // outpace it. Rather than hand back an overflowing bird that then needs
    // many real-time trips to work down, keep selling here — using the same
    // larger OVERFLOW_SELL_* caps the online path uses once over the cap —
    // until the simulated inventory is back under it (or the player can't
    // afford to buy any more). Bounded at 200 iterations purely as a
    // runaway guard; each iteration can clear up to OVERFLOW_SELL_MAX_PER_TRIP
    // units, so realistic stockpiles clear in well under that.
    for (let guard = 0; guard < 200; guard++) {
      const totalHeld = Object.values(nextInventory).reduce((sum, amount) => sum + (amount ?? 0), 0);
      const excess = totalHeld - BIRD_INVENTORY_CAP;
      if (excess <= 0) break;
      let bestId: MaterialId | null = null;
      let bestAmount = 0;
      for (const [materialId, amount] of Object.entries(nextInventory) as [MaterialId, number][]) {
        if ((amount ?? 0) > bestAmount) {
          bestId = materialId;
          bestAmount = amount ?? 0;
        }
      }
      if (!bestId) break;
      const unitPrice = MATERIAL_SELL_PRICE[bestId];
      const offeredAmount = Math.min(bestAmount, OVERFLOW_SELL_MAX_PER_TRIP, excess + OVERFLOW_SELL_MARGIN);
      const spendCap = Math.min(simulatedPlayerGold, OVERFLOW_SELL_MAX_GOLD_PER_TRIP);
      const affordableUnits = unitPrice > 0 ? Math.floor(spendCap / unitPrice) : 0;
      const soldAmount = Math.min(offeredAmount, affordableUnits);
      if (soldAmount <= 0) break; // player can't afford any more — same stopping condition as a single online sale
      const cost = soldAmount * unitPrice;
      nextInventory[bestId] = bestAmount - soldAmount;
      materialsSnapshot[bestId] = (materialsSnapshot[bestId] ?? 0) + soldAmount;
      simulatedPlayerGold -= cost;
      sellExpense += cost;
      sellGoldGained += cost;
    }

    const updatedWallet: BirdWallet = {
      ...wallet,
      gold: wallet.gold + goldGained + sellGoldGained,
      inventory: nextInventory,
      items: nextItems,
      level,
      exp,
      atk,
      maxHp,
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
    if (sellGoldGained > 0) highlights.push(`${c.name}が街に素材を売っていました(+${sellGoldGained}G)`);
  }

  // Traveler visits — same odds as the online path (see useWorldStore's
  // tick()), buying straight out of whatever the town happens to have in
  // stock right now (materialsSnapshot already reflects any bird sales
  // above, so a traveler can draw from stock the birds just sold in).
  let travelerIncome = 0;
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
    sellExpense,
    materialsDelta,
    birdOutcomes,
    highlight,
  };
}
