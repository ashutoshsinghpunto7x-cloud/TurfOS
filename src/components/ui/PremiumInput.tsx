import React, { useRef, useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, Animated, TextInputProps, ViewStyle,
} from 'react-native';
import { palette, radius, font, spacing } from '../../theme/theme';

interface Props extends TextInputProps {
  label?:       string;
  error?:       string;
  icon?:        string;
  rightIcon?:   string;
  onRightPress?:() => void;
  containerStyle?: ViewStyle;
  hint?:        string;
}

export default function PremiumInput({
  label, error, icon, rightIcon, onRightPress,
  containerStyle, hint, style, ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    rest.onFocus?.(null as any);
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    rest.onBlur?.(null as any);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? 'rgba(239,68,68,0.5)' : palette.borderSubtle, palette.accent],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[styles.inputWrap, { borderColor }]}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <TextInput
          style={[styles.input, icon && { paddingLeft: 0 }, style]}
          placeholderTextColor={palette.textTertiary}
          onFocus={onFocus}
          onBlur={onBlur}
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightPress} style={styles.rightBtn}>
            <Text style={styles.icon}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
      {error  && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label:     { fontSize: font.xs, fontWeight: font.bold, color: palette.textTertiary, textTransform: 'uppercase', letterSpacing: font.wider, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.glass2, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, gap: 10 },
  input:     { flex: 1, paddingVertical: spacing.sm + 2, fontSize: font.md, color: palette.textPrimary, fontWeight: font.medium },
  icon:      { fontSize: 17, opacity: 0.6 },
  rightBtn:  { padding: 4 },
  error:     { fontSize: font.xs, color: palette.redBright, marginTop: 6 },
  hint:      { fontSize: font.xs, color: palette.textTertiary, marginTop: 4 },
});