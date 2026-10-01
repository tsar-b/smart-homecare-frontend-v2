import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';
import { t, useLocale } from '../i18n';

export function PageIntro({ title, description }: { title: string; description?: string }) {
  useLocale();
  return (
    <View style={styles.intro}>
      <Text style={styles.title}>{t(title)}</Text>
      {description ? <Text style={styles.description}>{t(description)}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  useLocale();
  return <Text style={[styles.sectionTitle, style]}>{typeof children === 'string' ? t(children) : children}</Text>;
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 35,
    letterSpacing: -0.6,
    color: colors.text,
  },
  description: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
