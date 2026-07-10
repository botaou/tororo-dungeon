import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { BIRD_BASE_SPRITES } from '../game/birdBaseSprites';
import { CHARACTER_IMAGES } from '../game/characterImages';
import { cuteShadow } from '../theme';

interface Props {
  characterId: string;
  emoji: string;
  color: string;
  size?: number;
}

export function CharacterAvatar({ characterId, emoji, color, size = 40 }: Props) {
  // The full 2-head-tall standing sprite (assets/birds/{id}/base.png) takes
  // priority once it exists — it's drawn whole (no crop/circle), since a
  // full body doesn't fit a round mask the way the face-icon fallback does.
  const baseSprite = BIRD_BASE_SPRITES[characterId];
  if (baseSprite) {
    return <Image source={baseSprite} style={{ width: size, height: size }} resizeMode="contain" />;
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
