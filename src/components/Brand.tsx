import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';

type BrandProps = {
  compact?: boolean;
  style?: ViewStyle;
  light?: boolean;
};

export function Brand({ compact = false, style, light = false }: BrandProps) {
  const color = light ? colors.white : colors.primary;

  return (
    <View style={[styles.row, style]} accessibilityRole="header" accessibilityLabel="Smart Homecare">
      <Text style={[styles.mark, compact && styles.markCompact, { color }]}>SHC</Text>
      {!compact && (
        <>
          <View style={[styles.divider, { backgroundColor: color }]} />
          <Text style={[styles.name, { color }]}>SMART{`\n`}HOMECARE</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  mark: {
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.4,
  },
  markCompact: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -1,
  },
  divider: {
    width: 2,
    height: 28,
    marginHorizontal: spacing.sm,
    borderRadius: 1,
    opacity: 0.24,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.4,
  },
});
