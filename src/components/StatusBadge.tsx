import React from 'react';
import { t, useLocale } from '../i18n';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/tokens';

const STATUS = {
  pending: { label: '대기', color: colors.warning, background: colors.warningSoft },
  confirmed: { label: '확정', color: colors.primaryDark, background: colors.primarySoft },
  assigned: { label: '배정', color: colors.primaryDark, background: colors.primarySoft },
  in_progress: { label: '진행 중', color: colors.primaryDark, background: colors.primarySoft },
  completed: { label: '완료', color: colors.success, background: colors.successSoft },
  cancelled: { label: '취소', color: colors.danger, background: colors.dangerSoft },
  대기: { label: '대기', color: colors.warning, background: colors.warningSoft },
  확정: { label: '확정', color: colors.primaryDark, background: colors.primarySoft },
  완료: { label: '완료', color: colors.success, background: colors.successSoft },
  취소: { label: '취소', color: colors.danger, background: colors.dangerSoft },
} as const;

export function StatusBadge({ status }: { status: string }) {
  useLocale();
  const item = STATUS[status as keyof typeof STATUS] ?? {
    label: status,
    color: colors.textSecondary,
    background: colors.disabledSoft,
  };

  return (
    <View style={[styles.badge, { backgroundColor: item.background }]}>
      <Text style={[styles.label, { color: item.color }]}>{t(item.label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
});
