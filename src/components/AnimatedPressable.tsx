import React, { useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, StyleProp, ViewStyle } from 'react-native';

interface Props {
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Drop-in replacement for TouchableOpacity that gives a small press-in
// "bounce" (scale + opacity dip) so taps feel more responsive/game-like.
export function AnimatedPressable({ onPress, disabled, style, children }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = scale.interpolate({ inputRange: [0.93, 1], outputRange: [0.8, 1] });

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.93)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>{children}</Animated.View>
    </Pressable>
  );
}
