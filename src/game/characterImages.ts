// Character art registry. Drop PNG files into assets/characters/ (see the
// README there for naming/size conventions) and uncomment the matching line
// below. Until then, CharacterAvatar falls back to emoji + theme color.
export const CHARACTER_IMAGES: Partial<Record<string, ReturnType<typeof require>>> = {
  // tororo: require('../../assets/characters/tororo.png'),
  // vivi: require('../../assets/characters/vivi.png'),
  // haku: require('../../assets/characters/haku.png'),
  // mone: require('../../assets/characters/mone.png'),
};
