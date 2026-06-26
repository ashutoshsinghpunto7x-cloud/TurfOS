import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

export default function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  icon: { fontSize: 40, marginBottom: 12 },
  message: { fontSize: 14, color: colors.text3, textAlign: 'center', lineHeight: 20 },
});     