import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme/theme';

interface Props {
  total: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function SaleToast({ total, onUndo, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide up + fade in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto dismiss after 6 s
    const timer = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY }], opacity }]}>
      <View style={styles.left}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <View>
          <Text style={styles.title}>Sale recorded</Text>
          <Text style={styles.amount}>₹{total}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.undoBtn} onPress={() => { onUndo(); dismiss(); }}>
        <Text style={styles.undoText}>UNDO</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#1A1916',
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  amount: {
    color: '#A8D5BC',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  undoBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  undoText: {
    color: '#7BC9A4',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
