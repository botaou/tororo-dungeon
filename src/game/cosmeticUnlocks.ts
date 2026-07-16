import { COSMETIC_ITEMS, COSMETIC_ITEM_MAP } from '../data/cosmetics';
import { useCosmeticStore } from '../store/useCosmeticStore';

// A costume that's neither wearable yet nor already sitting as an unspent
// ticket in the warehouse — the only kind worth rolling a new ticket for
// (a duplicate ticket for something already unlocked, or a second ticket
// for something already waiting to be gifted, would just be dead weight).
function pickLockedUnticketedCosmeticId(): string | null {
  const { unlockedCosmeticIds, ticketCounts } = useCosmeticStore.getState();
  const candidates = COSMETIC_ITEMS.filter(
    (c) => !unlockedCosmeticIds.includes(c.id) && (ticketCounts[c.id] ?? 0) === 0
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

// Rolls `chance`; on success, awards a ticket for a random still-locked,
// not-yet-ticketed costume and returns {cosmeticId, name} for logging/
// notification (the caller already knows which route called it, so the
// source label itself is attached there, not here). Returns null both on a
// missed roll and when nothing is left to discover — mirrors
// game/recipeUnlocks.ts's maybeUnlockRandomRecipe (used for both the
// 'find' route, per gather completion, and the 'drop' route, per enemy
// kill — they're mechanically identical, just different call sites/chances/
// source labels), except a costume roll only ever grants a *ticket*, never
// an instant unlock — the player still has to spend it (see
// useCosmeticStore.giftCosmetic).
export function maybeAwardCosmeticTicket(chance: number): { cosmeticId: string; name: string } | null {
  if (Math.random() >= chance) return null;
  const cosmeticId = pickLockedUnticketedCosmeticId();
  if (!cosmeticId) return null;
  if (!useCosmeticStore.getState().addTicket(cosmeticId)) return null;
  return { cosmeticId, name: COSMETIC_ITEM_MAP[cosmeticId].name };
}
