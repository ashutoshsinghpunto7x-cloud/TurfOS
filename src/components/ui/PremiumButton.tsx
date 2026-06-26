import React, { useRef } from 'react';
import {
  TouchableOpacity, Animated, Text, StyleSheet,
  ActivityIndicator, ViewStyle, TextStyle,
} from 'react-native';
import { palette, radius, font, shadow, spacing } from '../../theme/theme';

interface Props {
  label:    string;
  onPress:  () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'violet';
  size?:    'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?:boolean;
  icon?:    string;
  style?:   ViewStyle;
  textStyle?:TextStyle;
  fullWidth?:boolean;
}

export default function PremiumButton({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, icon, style, textStyle, fullWidth = true,
}: Props) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onIn  = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.97, useNativeDriver: true, tension: 400 }),
      Animated.timing(opacity, { toValue: 0.85, duration: 80, useNativeDriver: true }),
    ]).start();
  };
  const onOut = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, tension: 400 }),
      Animated.timing(opacity, { toValue: 1,   duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const bg: Record<string, string> = {
    primary:   palette.accent,
    secondary: palette.glass3,
    ghost:     'transparent',
    danger:    palette.redSoft,
    success:   palette.emeraldSoft,
    violet:    palette.violet,
  };

  const borderColor: Record<string, string> = {
    primary:   'transparent',
    secondary: palette.borderLight,
    ghost:     palette.borderLight,
    danger:    'rgba(239,68,68,0.4)',
    success:   'rgba(16,185,129,0.4)',
    violet:    'rgba(124,58,237,0.5)',
  };

  const textColor: Record<string, string> = {
    primary:   '#fff',
    secondary: palette.textSecondary,
    ghost:     palette.textSecondary,
    danger:    palette.redBright,
    success:   palette.emeraldBright,
    violet:    '#fff',
  };

  const btnShadow = {
    primary: shadow.accent,
    secondary: {},
    ghost: {},
    danger: {},
    success: shadow.emerald,
    violet: shadow.violet,
  }[variant];

  const paddingV = { sm: 10, md: 14, lg: 17 }[size];
  const fs       = { sm: font.sm, md: font.md, lg: font.lg }[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      activeOpacity={1}
      disabled={disabled || loading}
      style={fullWidth ? { width: '100%' } : {}}
    >
      <Animated.View style={[
        styles.btn,
        {
          backgroundColor: bg[variant],
          borderColor:     borderColor[variant],
          paddingVertical: paddingV,
          opacity: (disabled || loading) ? 0.6 : opacity,
          transform: [{ scale }],
        },
        btnShadow,
        style,
      ]}>
        {loading ? (
          <ActivityIndicator color={textColor[variant]} size="small" />
        ) : (
          <Text style={[
            styles.label,
            { color: textColor[variant], fontSize: fs },
            textStyle,
          ]}>
            {icon ? `${icon}  ` : ''}{label}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:   { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  label: { fontWeight: font.extrabold, letterSpacing: 0.2 },
});