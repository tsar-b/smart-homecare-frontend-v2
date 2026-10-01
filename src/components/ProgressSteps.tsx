import React from 'react';
import { t, useLocale } from '../i18n';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/tokens';

type ProgressStepsProps = {
  steps: string[];
  current: number;
};

export function ProgressSteps({ steps, current }: ProgressStepsProps) {
  useLocale();
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}>
      <Text style={styles.count}>{current + 1} / {steps.length}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((current + 1) / steps.length) * 100}%` }]} />
      </View>
      <Text style={styles.label}>{t(steps[current])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.xl,
  },
  count: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  track: {
    width: '100%',
    height: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  label: {
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
