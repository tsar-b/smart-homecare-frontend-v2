import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, fonts, spacing } from '../theme/tokens';
import { t, useLocale } from '../i18n';

type StateViewProps = {
  title: string;
  message?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateView({
  title,
  message,
  icon = 'information-circle-outline',
  loading = false,
  actionLabel,
  onAction,
}: StateViewProps) {
  useLocale();
  return (
    <View style={styles.wrap} accessibilityRole={loading ? 'progressbar' : 'summary'}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={34} color={colors.primary} />
      )}
      <Text style={styles.title}>{t(title)}</Text>
      {message ? <Text style={styles.message}>{t(message)}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    marginTop: spacing.md,
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.lg,
  },
});
