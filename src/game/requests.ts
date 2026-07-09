import { BirdState, CharacterDef, JobRequest } from '../types';

const ACCEPT_THRESHOLD = 0.45;

interface ScoreContext {
  vanguardOutInField: boolean; // true if the vanguard bird is currently away from town
}

// How willing a bird is to take a given request, from 0 (never) to 1
// (definitely) — a "would I take this job" score, not a command. Rolled
// against Math.random() by the caller, so even a high score can still be
// declined some of the time, and nothing is ever forced.
export function scoreRequestAcceptance(
  bird: BirdState,
  def: CharacterDef,
  request: JobRequest,
  ctx: ScoreContext
): number {
  let score = 0;

  switch (def.personality) {
    case 'freeSpirit':
      score += 0.5; // Mone loves a good gathering job
      break;
    case 'cautious':
      score += 0.15;
      break;
    case 'clingy':
      score += 0.15;
      break;
    case 'vanguard':
      score += 0.1; // Tororo would rather be exploring
      break;
  }

  score += Math.min(0.4, request.reward / 200);

  switch (bird.mood) {
    case 'wantsMoney':
      score += 0.35;
      break;
    case 'sleepy':
      score -= 0.3;
      break;
    case 'hungry':
      score -= 0.1;
      break;
    case 'happy':
      score += 0.05;
      break;
  }

  if (def.personality === 'clingy') {
    // "誰かと一緒なら受けやすい" — she'd rather go if the vanguard is also out.
    score += ctx.vanguardOutInField ? 0.3 : -0.2;
  }
  if (def.personality === 'cautious' && request.reward < 20) {
    // Not worth the risk for cheap requests.
    score -= 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

// Picks the single best open request for this bird (if any clears the
// threshold), then rolls against its score — declining is always possible.
export function tryAcceptRequest(
  bird: BirdState,
  def: CharacterDef,
  openRequests: JobRequest[],
  ctx: ScoreContext
): JobRequest | null {
  let best: JobRequest | null = null;
  let bestScore = 0;
  for (const request of openRequests) {
    const score = scoreRequestAcceptance(bird, def, request, ctx);
    if (score > bestScore) {
      bestScore = score;
      best = request;
    }
  }
  if (!best || bestScore < ACCEPT_THRESHOLD) return null;
  return Math.random() < bestScore ? best : null;
}
