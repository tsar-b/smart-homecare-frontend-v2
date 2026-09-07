import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
};

export function FormField({ label, error, helper, style, ...props }: FormFieldProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.multiline, error && styles.inputError, style]}
        placeholderTextColor={colors.disabled}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: layout.minTouchTarget + 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    marginTop: spacing.xs,
    color: colors.danger,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  helper: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
