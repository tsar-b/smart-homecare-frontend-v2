import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: { color: string } }> = {
  primary: { container: { backgroundColor: colors.primary }, text: { color: colors.white } },
  secondary: {
    container: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
    text: { color: colors.primaryDark },
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: colors.border },
    text: { color: colors.text },
  },
  danger: {
    container: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
    text: { color: colors.danger },
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const palette = variantStyles[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        palette.container,
        fullWidth && styles.fullWidth,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text.color} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={palette.text.color} style={styles.icon} /> : null}
          <Text style={[styles.label, palette.text]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.minTouchTarget + 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  icon: {
    marginRight: spacing.xs,
  },
  disabled: {
    opacity: 0.52,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
});
