import { t, useLocale } from '../i18n';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from './Brand';
import { colors, fonts, layout, spacing } from '../theme/tokens';

type AppHeaderProps = {
  title?: string;
  eyebrow?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  showBrand?: boolean;
};

export function AppHeader({ title, eyebrow, onBack, action, showBrand = false }: AppHeaderProps) {
  useLocale();
  return (
    <View style={styles.header}>
      <View style={styles.leading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("뒤로 가기")}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : showBrand ? (
          <Brand compact />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.titleWrap} pointerEvents="none">
        {eyebrow ? <Text style={styles.eyebrow}>{t(eyebrow)}</Text> : null}
        {title ? <Text style={styles.title} numberOfLines={1}>{t(title)}</Text> : null}
      </View>

      <View style={styles.trailing}>{action ?? <View style={styles.placeholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: layout.horizontalPadding,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.background,
  },
  leading: {
    width: 76,
    alignItems: 'flex-start',
  },
  trailing: {
    width: 76,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 44,
    height: 44,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.primarySoft,
    opacity: 0.8,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
});
