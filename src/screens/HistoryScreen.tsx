import { t, useLocale, formatMoney } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError, customerSafeErrorMessage } from '../api';
import {
  AppHeader,
  AppScreen,
  Card,
  CustomerBottomNav,
  PageIntro,
  StateView,
  StatusBadge,
} from '../components';
import { useAuth } from '../context/AuthContext';
import type { AppCatalog, ServiceRequest } from '../domain';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';
import { LatestRequest } from '../utils/latestRequest';

type HistoryNavigation = NativeStackNavigationProp<RootStackParamList, 'History'>;
type DateField = 'start' | 'end';

function calendarKey(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

function parseCalendarKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format('YYYY-MM-DD') === value ? parsed.toDate() : null;
}

function formatPrice(price: number): string {
  return price < 0 ? t('가격 문의') : formatMoney(price, 'KRW');
}

function historyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'REQUEST_CANCELLED') return '';
    if (error.status === 401) return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
    if (error.code === 'NETWORK_ERROR') return '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
    if (error.code === 'BOOKING_HISTORY_FAILED') {
      return '예약 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }
  return customerSafeErrorMessage(
    error,
    '예약 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  );
}

function requestDateKey(request: ServiceRequest): string {
  const direct = request.reservationDate.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(direct) ? direct : '';
}

function HistoryScreen() {
  useLocale();
  const navigation = useNavigation<HistoryNavigation>();
  const { api, configurationError } = useAuth();
  const [requests, setRequests] = useState<readonly ServiceRequest[]>([]);
  const [catalog, setCatalog] = useState<AppCatalog | null>(null);
  const [startDate, setStartDate] = useState(() => dayjs().subtract(30, 'day').toDate());
  const [endDate, setEndDate] = useState(() => new Date());
  const [startDraft, setStartDraft] = useState(() => calendarKey(dayjs().subtract(30, 'day').toDate()));
  const [endDraft, setEndDraft] = useState(() => calendarKey(new Date()));
  const [openPicker, setOpenPicker] = useState<DateField | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyRequest = useRef(new LatestRequest());

  const loadHistory = useCallback(
    async (refresh = false) => {
      const request = historyRequest.current.start();
      if (!api) {
        setError(configurationError ?? '서버 연결 설정이 필요합니다.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      try {
        const [history, initialization] = await Promise.all([
          api.requests.list({ signal: request.signal }),
          api.catalog.initialize({ signal: request.signal }).catch(() => null),
        ]);
        if (!request.isCurrent()) return;
        setRequests(history);
        if (initialization) setCatalog(initialization.catalog);
      } catch (caught) {
        if (!request.isCurrent()) return;
        const message = historyErrorMessage(caught);
        if (message) setError(message);
      } finally {
        if (request.isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, configurationError],
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
      return () => historyRequest.current.cancel();
    }, [loadHistory]),
  );

  const serviceLabels = useMemo(
    () => new Map(catalog?.serviceTypes.map((item) => [item.id, item.label]) ?? []),
    [catalog],
  );
  const subtypeLabels = useMemo(
    () => new Map(catalog?.subtypes.map((item) => [item.id, item.label]) ?? []),
    [catalog],
  );

  const filteredRequests = useMemo(() => {
    const from = calendarKey(startDate);
    const to = calendarKey(endDate);
    return requests.filter((request) => {
      const requestDate = requestDateKey(request);
      return requestDate !== '' && requestDate >= from && requestDate <= to;
    });
  }, [endDate, requests, startDate]);

  const commitWebDate = (field: DateField) => {
    const value = field === 'start' ? startDraft : endDraft;
    const parsed = parseCalendarKey(value);
    if (!parsed) {
      setDateError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }

    if (field === 'start') {
      const nextEnd = parsed > endDate ? parsed : endDate;
      setStartDate(parsed);
      setEndDate(nextEnd);
      setEndDraft(calendarKey(nextEnd));
    } else {
      const nextStart = parsed < startDate ? parsed : startDate;
      setStartDate(nextStart);
      setStartDraft(calendarKey(nextStart));
      setEndDate(parsed);
    }
    setDateError(null);
  };

  // A new onChange identity updates an already-open Android dialog. Keep
  // history/catalog/loading refreshes from resetting its uncommitted date.
  const selectNativeDate = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    setOpenPicker(null);
    if (event.type !== 'set' || !selected || !openPicker) return;

    if (openPicker === 'start') {
      const nextEnd = selected > endDate ? selected : endDate;
      setStartDate(selected);
      setStartDraft(calendarKey(selected));
      setEndDate(nextEnd);
      setEndDraft(calendarKey(nextEnd));
    } else {
      const nextStart = selected < startDate ? selected : startDate;
      setStartDate(nextStart);
      setStartDraft(calendarKey(nextStart));
      setEndDate(selected);
      setEndDraft(calendarKey(selected));
    }
    setDateError(null);
  }, [endDate, openPicker, startDate]);

  const renderDateField = (field: DateField, label: string, date: Date, draft: string) => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>{t(label)}</Text>
          <TextInput
            value={draft}
            onChangeText={field === 'start' ? setStartDraft : setEndDraft}
            onBlur={() => commitWebDate(field)}
            onSubmitEditing={() => commitWebDate(field)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.disabled}
            inputMode="numeric"
            accessibilityLabel={`${label} 날짜`}
            style={styles.webDateInput}
          />
        </View>
      );
    }

    return (
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>{t(label)}</Text>
        <Pressable
          onPress={() => setOpenPicker(field)}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${dayjs(date).format(t('YYYY년 M월 D일'))}`}
          accessibilityHint={t("날짜 선택기를 엽니다")}
          style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.dateValue}>{dayjs(date).format('YYYY. M. D.')}</Text>
        </Pressable>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: ServiceRequest }) => {
    const serviceLabel =
      (item.serviceTypeId ? serviceLabels.get(item.serviceTypeId) : undefined) ??
      item.serviceLabel ??
      item.serviceType ??
      (item.subtypeId ? subtypeLabels.get(item.subtypeId) : undefined) ??
      '홈케어 서비스';
    const subtypeLabel =
      (item.subtypeId ? subtypeLabels.get(item.subtypeId) : undefined) ??
      item.subtype ??
      undefined;

    return (
      <Pressable
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`${serviceLabel}, ${dayjs(item.reservationDate).format(t('YYYY년 M월 D일'))}, ${formatPrice(item.totalPrice)}`}
        accessibilityHint={t("예약 상세 정보를 엽니다")}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Card style={styles.requestCard} elevated>
          <View style={styles.requestHeading}>
            <View style={styles.requestTitleWrap}>
              <Text style={styles.requestTitle} numberOfLines={1}>{t(serviceLabel)}</Text>
              {subtypeLabel && subtypeLabel !== serviceLabel ? (
                <Text style={styles.requestSubtitle} numberOfLines={1}>{t(subtypeLabel)}</Text>
              ) : null}
            </View>
            <StatusBadge status={item.status} />
          </View>

          <View style={styles.requestMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={17} color={colors.textMuted} />
              <View style={styles.metaCopy}>
                <Text style={styles.metaText}>
                  {dayjs(item.reservationDate).format('YYYY. M. D.')} {item.reservationTime}
                </Text>
                {item.optionSnapshots.length > 0 ? (
                  <Text style={styles.optionCount}>{t("선택 옵션")}{item.optionSnapshots.length}{t("개")}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
              <Ionicons name="chevron-forward" size={19} color={colors.disabled} />
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  const emptyState = error ? (
    <StateView
      title={t("예약 내역을 불러오지 못했습니다")}
      message={error}
      icon="cloud-offline-outline"
      actionLabel={t("다시 시도")}
      onAction={() => void loadHistory()}
    />
  ) : (
    <StateView
      title={t("이 기간에는 예약이 없습니다")}
      message={t("기간을 넓히거나 홈에서 새 서비스를 예약해 보세요.")}
      icon="calendar-clear-outline"
      actionLabel={t("서비스 둘러보기")}
      onAction={() => navigation.navigate('Home')}
    />
  );

  return (
    <AppScreen padded={false} footer={<CustomerBottomNav active="History" />}>
      <AppHeader title={t("예약 내역")} showBrand />
      <View style={styles.content}>
        <PageIntro
          title={t("내 예약")}
          description={t("예약 진행 상태와 방문 일정을 한눈에 확인하세요.")}
        />

        <Card style={styles.filterCard}>
          <View style={styles.filterHeading}>
            <Text style={styles.filterTitle}>{t("조회 기간")}</Text>
            {!loading ? <Text style={styles.resultCount}>{filteredRequests.length}{t("건")}</Text> : null}
          </View>
          <View style={styles.filterRow}>
            {renderDateField('start', t('시작일'), startDate, startDraft)}
            {renderDateField('end', t('종료일'), endDate, endDraft)}
          </View>
          {dateError ? <Text style={styles.dateError}>{t(dateError)}</Text> : null}
        </Card>

        {openPicker ? (
          <DateTimePicker
            value={openPicker === 'start' ? startDate : endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={openPicker === 'start' ? endDate : undefined}
            minimumDate={openPicker === 'end' ? startDate : undefined}
            onChange={selectNativeDate}
          />
        ) : null}

        {error && requests.length > 0 ? (
          <View style={styles.inlineError} accessibilityRole="alert">
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.inlineErrorText}>{t(error)}</Text>
          </View>
        ) : null}

        {loading && requests.length === 0 ? (
          <StateView title={t("예약 내역을 불러오는 중입니다")} loading />
        ) : (
          <FlatList
            data={filteredRequests}
            keyExtractor={(item) => item.id}
            renderItem={renderRequest}
            ListEmptyComponent={emptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadHistory(true)}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              filteredRequests.length === 0 && styles.emptyListContent,
            ]}
          />
        )}
      </View>
    </AppScreen>
  );
}

export default HistoryScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.lg,
  },
  filterCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  filterHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  filterTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  resultCount: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    marginBottom: spacing.xs,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  dateButton: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  dateValue: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  webDateInput: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  dateError: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.danger,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  listContent: {
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  requestCard: {
    padding: spacing.md,
  },
  requestHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  requestTitleWrap: {
    flex: 1,
  },
  requestTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  requestSubtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  requestMeta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaCopy: {
    flex: 1,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  optionCount: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  price: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.72,
  },
});
