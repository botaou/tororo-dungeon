// Full 2-head-tall base body art registry — the on-map standing sprite
// (distinct from assets/characters/, which is a round face-icon for
// possible future menu/portrait use). Drop base.png into
// assets/birds/{id}/ (see the README there for the canvas size/anchor
// convention shared with future equipment and animation frames) and
// uncomment the matching line below. Until then, CharacterAvatar falls
// back to the round portrait icon, then emoji.
export const BIRD_BASE_SPRITES: Partial<Record<string, ReturnType<typeof require>>> = {
  // tororo: require('../../assets/birds/tororo/base.png'),
  // vivi: require('../../assets/birds/vivi/base.png'),
  // haku: require('../../assets/birds/haku/base.png'),
  // mone: require('../../assets/birds/mone/base.png'),
};
