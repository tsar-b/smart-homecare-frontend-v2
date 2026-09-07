import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';

import {
  AdminBottomNav,
  AppHeader,
  AppScreen,
  Card,
  PageIntro,
  SectionTitle,
} from '../../components';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, fonts, layout, radius, spacing } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Overview = {
  accountCount: number | null;
  bookingCount: number | null;
  pendingCount: number | null;
  confirmedCount: number | null;
};

const emptyOverview: Overview = {
  accountCount: null,
  bookingCount: null,
  pendingCount: null,
  confirmedCount: null,
};

function MetricCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  loading: boolean;
}) {
  const displayValue = value === null ? '—' : value.toLocaleString();

  return (
    <Card style={styles.metricCard}>
      <View style={styles.metricTopRow}>
        <View style={styles.metricIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        {loading && value === null ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      <Text style={styles.metricValue}>{displayValue}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

function QuickLink({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}
    >
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.quickLinkCopy}>
        <Text style={styles.quickLinkTitle}>{title}</Text>
        <Text style={styles.quickLinkDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function AdminDashboard() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { api, currentUser } = useAuth();
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const rangeStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const rangeEnd = dayjs().format('YYYY-MM-DD');

  const loadOverview = useCallback(async () => {
    if (!api) {
      setLoading(false);
      setHasError(true);
      return;
    }

    setLoading(true);
    setHasError(false);

    const requestRange = {
      page: 1,
      pageSize: 1,
      dateFrom: rangeStart,
      dateTo: rangeEnd,
    } as const;
    const [usersResult, requestsResult, pendingResult, confirmedResult] =
      await Promise.allSettled([
        api.admin.list('users', { page: 1, pageSize: 1 }),
        api.admin.list('requests', requestRange),
        api.admin.list('requests', { ...requestRange, status: 'pending' }),
        api.admin.list('requests', { ...requestRange, status: 'confirmed' }),
      ]);

    setOverview({
      accountCount: usersResult.status === 'fulfilled' ? usersResult.value.total : null,
      bookingCount: requestsResult.status === 'fulfilled' ? requestsResult.value.total : null,
      pendingCount: pendingResult.status === 'fulfilled' ? pendingResult.value.total : null,
      confirmedCount:
        confirmedResult.status === 'fulfilled' ? confirmedResult.value.total : null,
    });
    setHasError(
      usersResult.status === 'rejected' ||
        requestsResult.status === 'rejected' ||
        pendingResult.status === 'rejected' ||
        confirmedResult.status === 'rejected',
    );
    setLoading(false);
  }, [api, rangeEnd, rangeStart]);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
  );

  const headerAction = (
    <Pressable
      onPress={() => void loadOverview()}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="운영 현황 새로고침"
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
    >
      <Ionicons name="refresh" size={21} color={loading ? colors.disabled : colors.primary} />
    </Pressable>
  );

  return (
    <AppScreen
      scroll
      padded={false}
      contentStyle={styles.screenContent}
      footer={
        <SafeAreaView edges={['bottom']} style={styles.navSafeArea}>
          <AdminBottomNav active="AdminDashboard" />
        </SafeAreaView>
      }
    >
      <AppHeader title="관리자" showBrand action={headerAction} />

      <View style={styles.body}>
        <PageIntro
          title="운영 현황"
          description={
            currentUser?.name
              ? `${currentUser.name} 관리자님, 최근 운영 데이터를 확인하세요.`
              : '최근 운영 데이터를 한눈에 확인하세요.'
          }
        />

        <View style={styles.sectionHeadingRow}>
          <SectionTitle style={styles.sectionTitle}>최근 30일</SectionTitle>
          <Text style={styles.rangeLabel}>
            {dayjs(rangeStart).format('M. D.')}–{dayjs(rangeEnd).format('M. D.')}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="calendar-outline"
            label="전체 예약"
            value={overview.bookingCount}
            loading={loading}
          />
          <MetricCard
            icon="time-outline"
            label="대기 예약"
            value={overview.pendingCount}
            loading={loading}
          />
          <MetricCard
            icon="checkmark-circle-outline"
            label="확정 예약"
            value={overview.confirmedCount}
            loading={loading}
          />
          <MetricCard
            icon="people-outline"
            label="등록 계정"
            value={overview.accountCount}
            loading={loading}
          />
        </View>

        {hasError ? (
          <View style={styles.warning} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              일부 현황을 불러오지 못했습니다. 새로고침하거나 각 관리 화면에서 확인해 주세요.
            </Text>
          </View>
        ) : null}

        <SectionTitle style={styles.quickSectionTitle}>빠른 관리</SectionTitle>
        <Card style={styles.quickLinksCard}>
          <QuickLink
            icon="calendar-outline"
            title="예약 관리"
            description="기간별 예약을 확인하고 상태와 가격을 변경합니다."
            onPress={() => navigation.navigate('AdminBookings')}
          />
          <View style={styles.divider} />
          <QuickLink
            icon="people-outline"
            title="사용자 관리"
            description="고객 정보와 관리자 권한을 관리합니다."
            onPress={() => navigation.navigate('AdminUsers')}
          />
          <View style={styles.divider} />
          <QuickLink
            icon="settings-outline"
            title="관리자 설정"
            description="내 계정 정보와 주소를 변경합니다."
            onPress={() => navigation.navigate('AdminSettings')}
          />
        </Card>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
  },
  body: {
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.xl,
  },
  navSafeArea: {
    backgroundColor: colors.surface,
  },
  headerAction: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: colors.primarySubtle,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  rangeLabel: {
    marginBottom: spacing.sm,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '47%',
    flexGrow: 1,
    minHeight: 142,
  },
  metricTopRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  metricValue: {
    marginTop: spacing.md,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
  },
  metricLabel: {
    marginTop: spacing.xxs,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  warning: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.warning,
  },
  quickSectionTitle: {
    marginTop: spacing.xl,
  },
  quickLinksCard: {
    padding: 0,
    overflow: 'hidden',
  },
  quickLink: {
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  quickLinkCopy: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  quickLinkTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  quickLinkDescription: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 42 + spacing.md,
    backgroundColor: colors.borderSoft,
  },
});
