// Full 2-head-tall base body art registry — the on-map standing sprite
// (distinct from assets/characters/, which is a round face-icon for
// possible future menu/portrait use). See assets/birds/README.md for the
// canvas size/anchor convention shared with future equipment and
// animation frames. Birds without an entry here fall back to the round
// portrait icon, then emoji (see CharacterAvatar).
export const BIRD_BASE_SPRITES: Partial<Record<string, ReturnType<typeof require>>> = {
  tororo: require('../../assets/birds/tororo/base.png'),
  vivi: require('../../assets/birds/vivi/base.png'),
  haku: require('../../assets/birds/haku/base.png'),
  mone: require('../../assets/birds/mone/base.png'),
};
