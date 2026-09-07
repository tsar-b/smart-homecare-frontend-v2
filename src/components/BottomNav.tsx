import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, layout, spacing } from '../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type BottomNavItem = {
  key: string;
  label: string;
  icon: IconName;
  activeIcon?: IconName;
  active?: boolean;
  onPress: () => void;
};

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.nav, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      accessibilityRole="tablist"
    >
      {items.map(item => {
        const color = item.active ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: Boolean(item.active) }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Ionicons
              name={item.active ? item.activeIcon ?? item.icon : item.icon}
              size={22}
              color={color}
            />
            <Text style={[styles.label, item.active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    width: '100%',
    minHeight: 68,
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: {
    minWidth: 64,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  pressed: {
    backgroundColor: colors.primarySubtle,
  },
  label: {
    marginTop: 2,
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
});
