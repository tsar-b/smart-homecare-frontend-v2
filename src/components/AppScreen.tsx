import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../theme/tokens';
import { LanguageSwitch } from '../i18n/LanguageSwitch';

type AppScreenProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardAware?: boolean;
};

export function AppScreen({
  children,
  footer,
  scroll = false,
  padded = true,
  contentStyle,
  keyboardAware = false,
}: AppScreenProps) {
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (!scroll) return undefined;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [scroll]);

  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        padded && styles.padded,
        footer ? styles.withFooter : null,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={footer ? ['top', 'left', 'right'] : ['top', 'right', 'bottom', 'left']}
    >
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={keyboardAware && Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.frame}>
          <LanguageSwitch />
          {content}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
  },
  padded: {
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.sm,
  },
  withFooter: {
    paddingBottom: spacing.xxl,
  },
});
