// Shared cute/cozy palette — soft pastels for a cheerful idle-town-sim
// look, instead of a dark dungeon-crawler theme.
export const theme = {
  bgTop: '#eaf6ff', // pale sky blue
  bgBottom: '#fff8ec', // warm cream, the app's main background
  ground: '#dcf0c8', // soft meadow green, the map/field background
  card: '#ffffff',
  cardBorder: '#f0d9b0',
  cardAlt: '#fff2df', // light peach, for buttons/rows inside cards
  divider: '#f0d9b0',
  textPrimary: '#5b4636', // warm dark brown, readable on light backgrounds
  textSecondary: '#8a7862',
  textMuted: '#b0a08c',
  gold: '#f0a93a',
  green: '#6bbd6e',
  blue: '#5eb8d9',
  red: '#e8776c',
  orange: '#f2984f',
  pink: '#ff9fb3', // playful accent for highlights/titles
  disabled: '#e3d8c8',
  overlay: 'rgba(120, 90, 60, 0.35)',
  road: '#d9b98a', // warm dirt-road tan, for the town's street grid
  fence: '#a97c50', // wood-fence brown, for the town/field boundary marker
};

// A soft "sticker-like" drop shadow used on cards/buttons/sprites for a
// cuter, more tactile idle-game feel — spread this into a style array.
export const cuteShadow = {
  shadowColor: '#8a6a4a',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.18,
  shadowRadius: 5,
  elevation: 4,
};
