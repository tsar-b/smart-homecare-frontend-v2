import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/tokens';

type ChoiceChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function ChoiceChip({ label, selected = false, disabled = false, onPress }: ChoiceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  disabled: {
    backgroundColor: colors.disabledSoft,
    borderColor: colors.borderSoft,
  },
  pressed: {
    opacity: 0.78,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  labelSelected: {
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  labelDisabled: {
    color: colors.disabled,
  },
});
