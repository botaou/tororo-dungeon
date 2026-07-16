import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { BIRD_BASE_SPRITES } from '../game/birdBaseSprites';
import { CHARACTER_IMAGES } from '../game/characterImages';
import { getCosmeticDef } from '../data/cosmetics';
import { cuteShadow } from '../theme';

interface Props {
  characterId: string;
  emoji: string;
  color: string;
  size?: number;
  // A bird's currently-equipped costume (BirdState.cosmeticId), if any —
  // optional since not every caller has a live bird (e.g. RecruitmentModal/
  // CharacterSelectScreen show a character def before it even has a
  // wallet). See data/cosmetics.ts: this is a costume-only overlay (no bird
  // baked in), layered on top of the bird's own base sprite below rather
  // than replacing it, so the wearer's own face/color always shows through
  // whatever gap the costume has.
  cosmeticId?: string | null;
}

export function CharacterAvatar({ characterId, emoji, color, size = 40, cosmeticId }: Props) {
  // The full 2-head-tall standing sprite (assets/birds/{id}/base.png) takes
  // priority once it exists — it's drawn whole (no crop/circle), since a
  // full body doesn't fit a round mask the way the face-icon fallback does.
  const baseSprite = BIRD_BASE_SPRITES[characterId];
  if (baseSprite) {
    const cosmetic = getCosmeticDef(cosmeticId ?? null);
    return (
      <View style={{ width: size, height: size }}>
        <Image source={baseSprite} style={{ width: size, height: size }} resizeMode="contain" />
        {cosmetic && (
          <Image
            source={cosmetic.imageAsset}
            resizeMode="stretch"
            style={{
              position: 'absolute',
              width: size * cosmetic.widthFrac,
              height: size * cosmetic.heightFrac,
              left: size * cosmetic.centerXFrac - (size * cosmetic.widthFrac) / 2,
              top: size * cosmetic.centerYFrac - (size * cosmetic.heightFrac) / 2,
            }}
          />
        )}
      </View>
    );
  }

  const source = CHARACTER_IMAGES[characterId];
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.image, dimensionStyle, { borderColor: color }]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, dimensionStyle, { backgroundColor: color }]}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderWidth: 2 },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    ...cuteShadow,
  },
});
