import { BuildingKind, MaterialId, ShopKind } from '../types';

// A constructible building — offered in the ConstructionModal when tapping
// an unlocked, still-empty plot (see useTownStore's constructBuilding).
// `shopKind` is non-null only for options that place a working shop
// building; tapping the finished plot then reopens that shop's existing
// modal (shared stock with any other plot of the same kind — there's only
// ever one shelf per shop kind, "another storefront" is a flavor framing,
// not a second independent inventory). Decorative options (shopKind: null)
// are cosmetic-only once built — tapping them again does nothing.
export interface BuildingOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
  buildingKind: BuildingKind;
  shopKind: ShopKind | null;
  cost: { gold: number; materialId: MaterialId; materialAmount: number };
}

export const BUILDING_OPTIONS: BuildingOption[] = [
  {
    id: 'general_branch',
    name: '道具屋',
    emoji: '🛠️',
    description: '頭・手・足装備の品揃え。この店を建てるまで、鳥は防具/道具を買えません。',
    buildingKind: 'shop',
    shopKind: 'general',
    cost: { gold: 300, materialId: 'wood', materialAmount: 10 },
  },
  {
    id: 'feed_branch',
    name: '餌屋',
    emoji: '🌾',
    description: '餌の品揃え。この店を建てるまで、鳥は基本の餌だけで過ごします。',
    buildingKind: 'shop',
    shopKind: 'feed',
    cost: { gold: 250, materialId: 'berry', materialAmount: 10 },
  },
  {
    id: 'weapon_shop',
    name: '武器屋',
    emoji: '⚔️',
    description: '武器の品揃え。この店を建てるまで、鳥は武器を買えません。',
    buildingKind: 'shop',
    shopKind: 'weapon',
    cost: { gold: 400, materialId: 'ore', materialAmount: 12 },
  },
  {
    id: 'armor_shop',
    name: '防具屋',
    emoji: '🛡️',
    description: '防具の品揃え。この店を建てるまで、鳥は防具を買えません。',
    buildingKind: 'shop',
    shopKind: 'armor',
    cost: { gold: 400, materialId: 'feather', materialAmount: 12 },
  },
  {
    id: 'garden',
    name: '花壇',
    emoji: '🌷',
    description: '街を彩る花壇。実用的な機能はありませんが、街の見た目が賑やかになります。',
    buildingKind: 'garden',
    shopKind: null,
    cost: { gold: 100, materialId: 'mushroom', materialAmount: 5 },
  },
  {
    id: 'park',
    name: '公園',
    emoji: '🌳',
    description: '売買機能はありませんが、鳥たちが気分転換に遊びに来る場所になります。',
    buildingKind: 'park',
    shopKind: null,
    cost: { gold: 150, materialId: 'wood', materialAmount: 8 },
  },
  {
    id: 'bathhouse',
    name: '水浴び場',
    emoji: '🛁',
    description: '売買機能はありませんが、鳥たちが水浴びをして遊びに来る場所になります。',
    buildingKind: 'bathhouse',
    shopKind: null,
    cost: { gold: 150, materialId: 'waterweed', materialAmount: 8 },
  },
  // Phase 15③ shop expansion — same "build it to unlock it" pattern as
  // weapon_shop/armor_shop above, just for the 5 new ShopKinds.
  {
    id: 'clothing_shop',
    name: '服屋',
    emoji: '👗',
    description: '仕立て屋も兼ねる服屋。コスチューム図鑑から素材で仕立てられます。',
    buildingKind: 'shop',
    shopKind: 'clothing',
    cost: { gold: 350, materialId: 'herb', materialAmount: 10 },
  },
  {
    id: 'restaurant',
    name: '食堂',
    emoji: '🍽️',
    description: '街自慢の料理を並べる食堂。餌屋とは別に、ちょっと贅沢な一品を扱います。',
    buildingKind: 'shop',
    shopKind: 'restaurant',
    cost: { gold: 300, materialId: 'mushroom', materialAmount: 10 },
  },
  {
    id: 'furniture_shop',
    name: '家具屋',
    emoji: '🪑',
    description: '町長室に置く家具・マネキンを、素材から仕立てられます。',
    buildingKind: 'shop',
    shopKind: 'furniture',
    cost: { gold: 350, materialId: 'wood', materialAmount: 10 },
  },
  {
    id: 'toy_shop',
    name: 'おもちゃ屋',
    emoji: '🧸',
    description: 'おもちゃの品揃え。この店を建てるまで、おもちゃは扱えません。',
    buildingKind: 'shop',
    shopKind: 'toy',
    cost: { gold: 250, materialId: 'feather', materialAmount: 10 },
  },
  {
    id: 'mystery_shop',
    name: '怪しいアイテム屋',
    emoji: '🔮',
    description: 'ゴールドを払うと、何が出るか分からない品物を1つ引き当てられます。',
    buildingKind: 'shop',
    shopKind: 'mystery',
    cost: { gold: 400, materialId: 'magicStone', materialAmount: 5 },
  },
];

export function getBuildingOption(id: string | null): BuildingOption | null {
  if (!id) return null;
  return BUILDING_OPTIONS.find((o) => o.id === id) ?? null;
}
