import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

interface Props { title: string; action?: string; onAction?: () => void; }

export default function SectionHeader({ title, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title: { fontSize: 11, fontWeight: '700', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.6 },
  action: { fontSize: 13, fontWeight: '600', color: colors.accent },
});