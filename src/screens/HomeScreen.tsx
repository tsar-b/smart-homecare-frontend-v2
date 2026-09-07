import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppScreen,
  Brand,
  Button,
  CustomerBottomNav,
  SectionTitle,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, shadow, spacing } from '../theme/tokens';

type HomeNav = NativeStackNavigationProp<RootStackParamList>;
type HomeRoute = RouteProp<RootStackParamList, 'Home'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type QuickActionProps = {
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
  accessibilityHint: string;
};

function QuickAction({
  title,
  description,
  icon,
  onPress,
  accessibilityHint,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={23} color={colors.primary} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickDescription}>{description}</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.primary} style={styles.quickArrow} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const route = useRoute<HomeRoute>();
  const { isGuestMode } = useAuth();
  const isGuest = route.params?.isGuest ?? isGuestMode;

  const startBooking = () => navigation.navigate('BookingMenu', { isGuest });

  return (
    <AppScreen scroll footer={<CustomerBottomNav active="Home" />}>
      <View style={styles.brandRow}>
        <Brand />
        {isGuest ? (
          <View style={styles.guestBadge}>
            <Ionicons name="person-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.guestBadgeText}>비회원 이용 중</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="home-outline" size={25} color={colors.primaryDark} />
        </View>
        <Text style={styles.heroEyebrow}>SMART HOME SERVICE</Text>
        <Text style={styles.heroTitle}>집에 필요한 케어를{`\n`}간편하게 예약하세요</Text>
        <Text style={styles.heroDescription}>
          가전 선택부터 방문 일정까지 한 번에 확인할 수 있습니다.
        </Text>
        <Button
          label="서비스 예약하기"
          icon="calendar-outline"
          variant="secondary"
          onPress={startBooking}
          accessibilityHint="가전 선택 단계로 이동합니다"
          style={styles.heroButton}
        />
      </View>

      <SectionTitle style={styles.sectionTitle}>빠른 메뉴</SectionTitle>
      <View style={styles.quickGrid}>
        <View style={styles.quickCell}>
          <QuickAction
            title="홈케어 소개"
            description="서비스와 이용 방법을 살펴보세요."
            icon="globe-outline"
            onPress={() => void Linking.openURL('https://smarthomecare.kr')}
            accessibilityHint="스마트홈케어 웹사이트를 엽니다"
          />
        </View>
        <View style={styles.quickCell}>
          <QuickAction
            title="예약 내역"
            description="신청한 서비스의 상태를 확인하세요."
            icon="receipt-outline"
            onPress={() => navigation.navigate('History')}
            accessibilityHint="예약 내역 화면으로 이동합니다"
          />
        </View>
      </View>

      <View style={styles.assurance}>
        <View style={styles.assuranceIcon}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
        </View>
        <View style={styles.assuranceCopy}>
          <Text style={styles.assuranceTitle}>예약 정보를 한눈에</Text>
          <Text style={styles.assuranceText}>
            선택한 서비스, 예상 가격, 방문 일정을 예약 전에 다시 확인할 수 있습니다.
          </Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  guestBadge: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
  },
  guestBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primaryDark,
  },
  hero: {
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  heroIcon: {
    width: 44,
    height: 44,
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  heroEyebrow: {
    marginBottom: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    color: colors.primarySoft,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 27,
    lineHeight: 35,
    letterSpacing: -0.7,
    color: colors.white,
  },
  heroDescription: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.primarySoft,
  },
  heroButton: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  quickCell: {
    width: '50%',
    minWidth: 148,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
    flexGrow: 1,
  },
  quickAction: {
    minHeight: 174,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    ...shadow,
  },
  quickIcon: {
    width: 44,
    height: 44,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  quickTitle: {
    paddingRight: spacing.lg,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  quickDescription: {
    marginTop: spacing.xs,
    paddingRight: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  quickArrow: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  assurance: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success,
  },
  assuranceIcon: {
    width: 40,
    height: 40,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  assuranceCopy: {
    flex: 1,
  },
  assuranceTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  assuranceText: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
