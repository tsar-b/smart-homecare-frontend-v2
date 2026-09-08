import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationProp, useIsFocused, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';

import {
  AdminBottomNav,
  AppHeader,
  AppScreen,
  Button,
  Card,
  FormField,
  PageIntro,
  StateView,
  StatusBadge,
} from '../../components';
import { useAuth } from '../../context/AuthContext';
import type { ServiceRequest } from '../../domain';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, fonts, layout, radius, spacing } from '../../theme/tokens';
import { LatestRequest } from '../../utils/latestRequest';
import { parseAdminPrice } from './adminInput';

type ManagedStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

const statusOptions: ManagedStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

const statusLabels: Record<ManagedStatus, string> = {
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
};

const statusPalette: Record<
  ManagedStatus,
  { color: string; backgroundColor: string }
> = {
  pending: { color: colors.warning, backgroundColor: colors.warningSoft },
  confirmed: { color: colors.primaryDark, backgroundColor: colors.primarySoft },
  completed: { color: colors.success, backgroundColor: colors.successSoft },
  cancelled: { color: colors.danger, backgroundColor: colors.dangerSoft },
};

function managedStatus(status: string): ManagedStatus | null {
  switch (status) {
    case 'pending':
    case '대기':
      return 'pending';
    case 'confirmed':
    case 'approved':
    case '확정':
      return 'confirmed';
    case 'completed':
    case '완료':
      return 'completed';
    case 'cancelled':
    case 'canceled':
    case '취소':
      return 'cancelled';
    default:
      return null;
  }
}

type ActionTone = 'default' | 'primary' | 'danger';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function BookingAction({
  icon,
  label,
  tone = 'default',
  onPress,
}: {
  icon: IconName;
  label: string;
  tone?: ActionTone;
  onPress: () => void;
}) {
  const color =
    tone === 'danger' ? colors.danger : tone === 'primary' ? colors.primary : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.bookingAction, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.bookingActionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function DetailLine({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <View style={styles.detailLine}>
      <Ionicons name={icon} size={17} color={colors.textMuted} />
      <Text style={styles.detailLineText}>{children}</Text>
    </View>
  );
}

export default function AdminBookingList() {
  const { api } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();

  const [startDate, setStartDate] = useState(() => dayjs().subtract(30, 'day').toDate());
  const [endDate, setEndDate] = useState(() => new Date());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const [bookings, setBookings] = useState<readonly ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ServiceRequest | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ManagedStatus | null>(null);
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const bookingRequest = useRef(new LatestRequest());

  const fetchBookings = useCallback(async () => {
    if (!api) {
      setError('V2 API가 아직 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    if (dayjs(startDate).isAfter(dayjs(endDate), 'day')) {
      Alert.alert('날짜 확인', '시작일은 종료일보다 늦을 수 없습니다.');
      return;
    }

    const request = bookingRequest.current.start();
    setLoading(true);
    setError(null);
    try {
      const baseQuery = {
        pageSize: 100,
        dateFrom: dayjs(startDate).format('YYYY-MM-DD'),
        dateTo: dayjs(endDate).format('YYYY-MM-DD'),
        sort: 'reservation_date',
        direction: 'desc' as const,
      };
      const firstPage = await api.admin.list('requests', { ...baseQuery, page: 1 }, { signal: request.signal });
      if (!request.isCurrent()) return;
      const allRequests = [...firstPage.data];
      const pageCount = Math.ceil(firstPage.total / firstPage.pageSize);

      for (let page = 2; page <= pageCount; page += 1) {
        const nextPage = await api.admin.list('requests', { ...baseQuery, page }, { signal: request.signal });
        if (!request.isCurrent()) return;
        allRequests.push(...nextPage.data);
      }

      setBookings(allRequests);
    } catch (requestError) {
      if (!request.isCurrent()) return;
      console.error('fetchBookings error', requestError);
      setError('예약 목록을 불러오지 못했습니다.');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [api, endDate, startDate]);

  useEffect(() => {
    if (isFocused) {
      void fetchBookings();
    }
    return () => bookingRequest.current.cancel();
    // Date changes are applied only when the administrator presses search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isFocused]);

  const statusCounts = useMemo(() => {
    const counts: Record<ManagedStatus, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const request of bookings) {
      const status = managedStatus(request.status);
      if (status) counts[status] += 1;
    }
    return counts;
  }, [bookings]);

  const openEditor = (booking: ServiceRequest) => {
    setEditing(booking);
    setSelectedStatus(managedStatus(booking.status));
    setPrice(booking.totalPrice >= 0 ? booking.totalPrice.toString() : '');
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setPrice('');
  };

  const saveStatus = async () => {
    if (!editing || !selectedStatus || !api || saving) return;

    const payload: { status: string; totalPrice?: number } = {
      status: selectedStatus,
    };
    try {
      const parsedPrice = parseAdminPrice(price);
      if (parsedPrice !== undefined) payload.totalPrice = parsedPrice;
    } catch {
      Alert.alert('가격 확인', '총액은 0 이상의 정수로 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      await api.admin.update('requests', editing.id, payload);
      setEditing(null);
      await fetchBookings();
    } catch (requestError) {
      console.error('updateStatus error', requestError);
      Alert.alert('오류', '예약 상태를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBooking = (booking: ServiceRequest) => {
    Alert.alert(
      '예약 삭제',
      `${booking.name || '게스트'}님의 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            if (!api) return;
            try {
              await api.admin.remove('requests', booking.id);
              await fetchBookings();
            } catch (requestError) {
              console.error('deleteBooking error', requestError);
              Alert.alert('오류', '예약을 삭제하지 못했습니다.');
            }
          },
        },
      ],
    );
  };

  const copyAddress = async (address: string) => {
    try {
      await Clipboard.setStringAsync(address);
      Toast.show({
        type: 'success',
        text1: '주소를 복사했습니다',
        text2: address,
        position: 'bottom',
      });
    } catch {
      Alert.alert('복사 실패', '주소를 복사하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const headerAction = (
    <Pressable
      onPress={() => void fetchBookings()}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="예약 목록 새로고침"
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => [styles.headerAction, pressed && styles.actionPressed]}
    >
      <Ionicons name="refresh" size={21} color={loading ? colors.disabled : colors.primary} />
    </Pressable>
  );

  return (
    <>
      <AppScreen
        padded={false}
        contentStyle={styles.screenContent}
        footer={
          <SafeAreaView edges={['bottom']} style={styles.navSafeArea}>
            <AdminBottomNav active="AdminBookings" />
          </SafeAreaView>
        }
      >
        <AppHeader title="예약 관리" showBrand action={headerAction} />

        <View style={styles.body}>
          <PageIntro
            title="예약"
            description="기간별 예약을 조회하고 진행 상태와 결제 예정 금액을 관리하세요."
          />

          <Card style={styles.filterCard}>
            <Text style={styles.filterTitle}>조회 기간</Text>
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setShowStart(true)}
                accessibilityRole="button"
                accessibilityLabel={`시작일 ${dayjs(startDate).format('YYYY년 M월 D일')}`}
                style={({ pressed }) => [styles.dateButton, pressed && styles.actionPressed]}
              >
                <Text style={styles.dateLabel}>시작일</Text>
                <View style={styles.dateValueRow}>
                  <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                  <Text style={styles.dateValue}>{dayjs(startDate).format('YYYY. M. D.')}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setShowEnd(true)}
                accessibilityRole="button"
                accessibilityLabel={`종료일 ${dayjs(endDate).format('YYYY년 M월 D일')}`}
                style={({ pressed }) => [styles.dateButton, pressed && styles.actionPressed]}
              >
                <Text style={styles.dateLabel}>종료일</Text>
                <View style={styles.dateValueRow}>
                  <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                  <Text style={styles.dateValue}>{dayjs(endDate).format('YYYY. M. D.')}</Text>
                </View>
              </Pressable>
            </View>
            <Button
              label="예약 검색"
              icon="search"
              loading={loading}
              onPress={() => void fetchBookings()}
              style={styles.searchButton}
            />
          </Card>

          {showStart ? (
            <DateTimePicker
              value={startDate}
              mode="date"
              maximumDate={endDate}
              onChange={(_, date) => {
                setShowStart(false);
                if (date) setStartDate(date);
              }}
            />
          ) : null}
          {showEnd ? (
            <DateTimePicker
              value={endDate}
              mode="date"
              minimumDate={startDate}
              onChange={(_, date) => {
                setShowEnd(false);
                if (date) setEndDate(date);
              }}
            />
          ) : null}

          <View style={styles.resultHeading}>
            <Text style={styles.resultTitle}>조회 결과</Text>
            <Text style={styles.resultCount}>{bookings.length.toLocaleString()}건</Text>
          </View>

          <View style={styles.statusSummary}>
            {statusOptions.map(status => (
              <View
                key={status}
                style={[styles.statusSummaryItem, { backgroundColor: statusPalette[status].backgroundColor }]}
                accessibilityLabel={`${statusLabels[status]} 예약 ${statusCounts[status]}건`}
              >
                <Text style={[styles.statusSummaryValue, { color: statusPalette[status].color }]}>
                  {statusCounts[status]}
                </Text>
                <Text style={[styles.statusSummaryLabel, { color: statusPalette[status].color }]}>
                  {statusLabels[status]}
                </Text>
              </View>
            ))}
          </View>

          {error && bookings.length > 0 ? (
            <View style={styles.inlineError} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={19} color={colors.danger} />
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          {loading && bookings.length === 0 ? (
            <StateView title="예약 목록을 불러오는 중입니다" loading />
          ) : error && bookings.length === 0 ? (
            <StateView
              title="예약 목록을 불러오지 못했습니다"
              message="연결 상태를 확인한 뒤 다시 시도해 주세요."
              icon="cloud-offline-outline"
              actionLabel="다시 시도"
              onAction={() => void fetchBookings()}
            />
          ) : (
            <FlatList
              data={bookings}
              keyExtractor={booking => booking.id}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                bookings.length === 0 && styles.emptyListContent,
              ]}
              refreshing={loading}
              onRefresh={() => void fetchBookings()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <StateView
                  title="조회 기간에 예약이 없습니다"
                  message="기간을 변경한 뒤 다시 검색해 보세요."
                  icon="calendar-outline"
                />
              }
              renderItem={({ item }) => {
                const fullAddress = [item.address, item.detailAddress].filter(Boolean).join(' ');
                return (
                  <Card style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingIdentity}>
                      <Text style={styles.bookingName} numberOfLines={1}>
                        {item.name?.trim() || '게스트'}
                      </Text>
                      <Text style={styles.bookingId} numberOfLines={1}>
                        예약번호 {item.id}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>

                  <View style={styles.bookingDetails}>
                    <DetailLine icon="calendar-outline">
                      {dayjs(item.reservationDate).isValid()
                        ? dayjs(item.reservationDate).format('YYYY. M. D.')
                        : item.reservationDate || '날짜 미정'}
                      {item.reservationTime ? ` · ${item.reservationTime}` : ''}
                    </DetailLine>
                    {item.phone ? <DetailLine icon="call-outline">{item.phone}</DetailLine> : null}
                    {fullAddress ? (
                      <Pressable
                        onPress={() => void copyAddress(fullAddress)}
                        accessibilityRole="button"
                        accessibilityLabel={`주소 복사 ${fullAddress}`}
                        style={({ pressed }) => [styles.addressLine, pressed && styles.actionPressed]}
                      >
                        <Ionicons name="location-outline" size={17} color={colors.primary} />
                        <Text style={styles.addressText}>{fullAddress}</Text>
                        <Ionicons name="copy-outline" size={17} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>총액</Text>
                    <Text style={styles.priceValue}>
                      {item.totalPrice === -1
                        ? '가격 문의'
                        : `₩${item.totalPrice.toLocaleString()}`}
                    </Text>
                  </View>

                  <View style={styles.bookingActions}>
                    <BookingAction
                      icon="document-text-outline"
                      label="상세"
                      onPress={() =>
                        navigation.navigate('BookingDetail', {
                          bookingId: item.id,
                          viewMode: 'admin',
                        })
                      }
                    />
                    <View style={styles.actionDivider} />
                    <BookingAction
                      icon="create-outline"
                      label="상태·가격"
                      tone="primary"
                      onPress={() => openEditor(item)}
                    />
                    <View style={styles.actionDivider} />
                    <BookingAction
                      icon="trash-outline"
                      label="삭제"
                      tone="danger"
                      onPress={() => deleteBooking(item)}
                    />
                  </View>
                  </Card>
                );
              }}
            />
          )}
        </View>
      </AppScreen>

      <Modal
        transparent
        visible={editing !== null}
        animationType="fade"
        onRequestClose={closeEditor}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalCard} accessibilityViewIsModal>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Text style={styles.modalTitle}>예약 수정</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {editing?.name?.trim() || '게스트'}님의 예약
                  </Text>
                </View>
                <Pressable
                  onPress={closeEditor}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="예약 수정 창 닫기"
                  style={({ pressed }) => [styles.modalClose, pressed && styles.actionPressed]}
                >
                  <Ionicons name="close" size={23} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>예약 상태</Text>
              {editing && selectedStatus === null ? (
                <View style={styles.statusWarning} accessibilityRole="alert">
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                  <Text style={styles.statusWarningText}>
                    현재 상태 “{editing.status}”는 기본 상태가 아닙니다. 저장하려면 새 상태를 선택하세요.
                  </Text>
                </View>
              ) : null}
              <View style={styles.statusOptions} accessibilityRole="radiogroup">
                {statusOptions.map(status => {
                  const selected = selectedStatus === status;
                  return (
                    <Pressable
                      key={status}
                      onPress={() => setSelectedStatus(status)}
                      accessibilityRole="radio"
                      accessibilityLabel={statusLabels[status]}
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.statusOption,
                        { backgroundColor: statusPalette[status].backgroundColor },
                        selected && {
                          borderColor: statusPalette[status].color,
                          borderWidth: 2,
                        },
                        pressed && styles.actionPressed,
                      ]}
                    >
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={statusPalette[status].color}
                      />
                      <Text style={[styles.statusOptionText, { color: statusPalette[status].color }]}>
                        {statusLabels[status]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <FormField
                label="총액 (원)"
                value={price}
                onChangeText={setPrice}
                placeholder="미정이면 비워 두세요"
                keyboardType="number-pad"
                returnKeyType="done"
                helper="가격 문의 예약은 금액을 입력하지 않아도 됩니다."
              />

              <View style={styles.modalActions}>
                <Button
                  label="취소"
                  variant="ghost"
                  fullWidth={false}
                  disabled={saving}
                  onPress={closeEditor}
                  style={styles.modalButton}
                />
                <Button
                  label="변경 저장"
                  icon="checkmark"
                  fullWidth={false}
                  loading={saving}
                  disabled={selectedStatus === null}
                  onPress={() => void saveStatus()}
                  style={styles.modalButton}
                />
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
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
  actionPressed: {
    opacity: 0.68,
  },
  body: {
    flex: 1,
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.xl,
  },
  filterCard: {
    marginBottom: spacing.xl,
  },
  filterTitle: {
    marginBottom: spacing.sm,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateButton: {
    flex: 1,
    minHeight: 68,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
  },
  dateLabel: {
    marginBottom: spacing.xxs,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateValue: {
    marginLeft: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  searchButton: {
    marginTop: spacing.md,
  },
  resultHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  resultTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  resultCount: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  statusSummary: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statusSummaryItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSummaryValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  statusSummaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  inlineError: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineErrorText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  bookingCard: {
    marginBottom: spacing.sm,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bookingIdentity: {
    flex: 1,
    paddingRight: spacing.md,
  },
  bookingName: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  bookingId: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  bookingDetails: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLineText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  addressLine: {
    minHeight: layout.minTouchTarget,
    marginHorizontal: -spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    flex: 1,
    marginHorizontal: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primaryDark,
  },
  priceRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  priceValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  bookingActions: {
    minHeight: 54,
    marginTop: spacing.md,
    marginHorizontal: -spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bookingAction: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingActionText: {
    marginLeft: spacing.xxs,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
    backgroundColor: colors.borderSoft,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
  },
  modalSafeArea: {
    width: '100%',
    padding: layout.horizontalPadding,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 28,
    color: colors.text,
  },
  modalSubtitle: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  modalClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginTop: -spacing.xs,
    marginRight: -spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  statusWarning: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusWarningText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.warning,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  statusOption: {
    width: '47%',
    flexGrow: 1,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionText: {
    marginLeft: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
