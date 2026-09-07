import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';

export function PageIntro({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.intro}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
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
