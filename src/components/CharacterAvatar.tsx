import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { BIRD_BASE_SPRITES } from '../game/birdBaseSprites';
import { CHARACTER_IMAGES } from '../game/characterImages';
import { FACE_PATCH_CROP, getCosmeticDef } from '../data/cosmetics';
import { DEBUG_SHOW_SPRITE_BOUNDS } from '../game/config';
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
    const outerBoxStyle = {
      width: size,
      height: size,
      overflow: 'hidden' as const,
      ...(DEBUG_SHOW_SPRITE_BOUNDS ? { borderWidth: 1, borderColor: 'red' } : null),
    };

    // fullBody costumes (see Correction #6 in data/cosmetics.ts) ARE the
    // wearer's entire visible body — the real base sprite is not drawn at
    // all, only a small cropped face patch positioned inside the costume's
    // own face-hole, so the costume's own wings/feet/tail aren't drawn
    // alongside (and potentially poking out past) the wearer's own.
    if (cosmetic?.type === 'fullBody' && cosmetic.facePatch) {
      const { scale: fpScale, offsetX: fpOffsetX, offsetY: fpOffsetY } = cosmetic.facePatch;
      const patchSize = size * fpScale;
      const cropWFrac = FACE_PATCH_CROP.x1 - FACE_PATCH_CROP.x0;
      const cropHFrac = FACE_PATCH_CROP.y1 - FACE_PATCH_CROP.y0;
      // Renders the full base sprite oversized inside a small clipped
      // container, offset so only the FACE_PATCH_CROP region of it lands
      // inside — the same "zoom and shift inside overflow:hidden" trick
      // used to fake a source-rect crop, since a static require() Image
      // can't be cropped directly.
      const fullW = patchSize / cropWFrac;
      const fullH = patchSize / cropHFrac;
      return (
        <View style={outerBoxStyle}>
          <View
            style={{
              position: 'absolute',
              width: patchSize,
              height: patchSize,
              left: size * (0.5 + fpOffsetX) - patchSize / 2,
              top: size * (0.5 + fpOffsetY) - patchSize / 2,
              overflow: 'hidden',
              borderRadius: patchSize / 2,
            }}
          >
            <Image
              source={baseSprite}
              resizeMode="stretch"
              style={{
                position: 'absolute',
                width: fullW,
                height: fullH,
                left: -FACE_PATCH_CROP.x0 * fullW,
                top: -FACE_PATCH_CROP.y0 * fullH,
              }}
            />
          </View>
          <Image
            source={cosmetic.imageAsset}
            resizeMode="stretch"
            style={{
              position: 'absolute',
              width: size * cosmetic.scale,
              height: size * cosmetic.scale * cosmetic.aspect,
              left: size * (0.5 + cosmetic.offsetX) - (size * cosmetic.scale) / 2,
              top: size * (0.5 + cosmetic.offsetY) - (size * cosmetic.scale * cosmetic.aspect) / 2,
            }}
          />
        </View>
      );
    }

    return (
      // overflow: 'hidden' is a hard safety net — a costume's offset/scale
      // is tuned to sit fully inside this box, but the box sits right next
      // to sibling badges in some callers (WorldMap's BirdSprite has a
      // sulk/pickaxe emoji at top:-10/-8, just outside its own avatar box),
      // so anything that *did* slip past the edge would visibly collide
      // with them instead of just looking slightly off.
      <View style={outerBoxStyle}>
        <Image source={baseSprite} style={{ width: size, height: size }} resizeMode="contain" />
        {cosmetic && (
          <Image
            source={cosmetic.imageAsset}
            resizeMode="stretch"
            style={{
              position: 'absolute',
              width: size * cosmetic.scale,
              height: size * cosmetic.scale * cosmetic.aspect,
              left: size * (0.5 + cosmetic.offsetX) - (size * cosmetic.scale) / 2,
              top: size * (0.5 + cosmetic.offsetY) - (size * cosmetic.scale * cosmetic.aspect) / 2,
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
