import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, ViewStyle } from 'react-native';
import { palette, radius, shadow } from '../../theme/theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  variant?: 'glass' | 'solid' | 'accent' | 'violet' | 'success' | 'danger';
  disabled?: boolean;
  noPress?: boolean;
}

export default function PremiumCard({
  children, onPress, style, variant = 'glass', disabled, noPress,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn  = () => onPress && Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const onOut = () => onPress && Animated.spring(scale, { toValue: 1,     useNativeDriver: true, tension: 300, friction: 20 }).start();

  const variantStyle: ViewStyle = {
    glass:   { backgroundColor: palette.glass2,    borderColor: palette.borderSubtle },
    solid:   { backgroundColor: palette.midnight,   borderColor: palette.borderFaint  },
    accent:  { backgroundColor: palette.accentSoft, borderColor: 'rgba(59,130,246,0.3)' },
    violet:  { backgroundColor: palette.violetSoft, borderColor: 'rgba(124,58,237,0.3)' },
    success: { backgroundColor: palette.emeraldSoft,borderColor: 'rgba(16,185,129,0.3)'  },
    danger:  { backgroundColor: palette.redSoft,    borderColor: 'rgba(239,68,68,0.3)'   },
  }[variant];

  const shadowStyle = {
    glass:   shadow.md,
    solid:   shadow.sm,
    accent:  shadow.accent,
    violet:  shadow.violet,
    success: shadow.emerald,
    danger:  shadow.sm,
  }[variant];

  const inner = (
    <Animated.View
      style={[
        styles.base,
        variantStyle,
        shadowStyle,
        { transform: [{ scale }], opacity: disabled ? 0.55 : 1 },
        style as ViewStyle,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (noPress || !onPress) return inner;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      activeOpacity={1}
      disabled={disabled}
    >
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth:  1,
    borderRadius: radius.lg,
    overflow:     'hidden',
  },
});