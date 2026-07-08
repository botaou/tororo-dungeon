import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { CHARACTER_IMAGES } from '../game/characterImages';

interface Props {
  characterId: string;
  emoji: string;
  color: string;
  size?: number;
}

export function CharacterAvatar({ characterId, emoji, color, size = 40 }: Props) {
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
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
