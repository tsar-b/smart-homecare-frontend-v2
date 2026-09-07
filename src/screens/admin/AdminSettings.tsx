import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AdminBottomNav,
  AppHeader,
  AppScreen,
  Button,
  Card,
  FormField,
  PageIntro,
  SectionTitle,
  StateView,
} from '../../components';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { colors, fonts, layout, radius, spacing } from '../../theme/tokens';

type Field = 'name' | 'phone';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type AdminSettingsRoute = RouteProp<RootStackParamList, 'AdminSettings'>;

type UserInfo = {
  name: string;
  phone: string;
  address: string;
  addressDetail: string;
};

const emptyUserInfo: UserInfo = {
  name: '',
  phone: '',
  address: '',
  addressDetail: '',
};

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function formatPhone(phone: string) {
  const digits = cleanPhone(phone);
  return digits.length === 11
    ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    : phone;
}

function SettingRow({
  icon,
  title,
  value,
  actionLabel = '변경',
  onPress,
  loading = false,
}: {
  icon: IconName;
  title: string;
  value: string;
  actionLabel?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon} accessibilityElementsHidden>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${actionLabel}`}
        accessibilityState={{ disabled: loading, busy: loading }}
        style={({ pressed }) => [styles.changeButton, pressed && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Text style={styles.changeButtonText}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function AdminSettings() {
  const { api, logout, refreshProfile } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<AdminSettingsRoute>();

  const [userInfo, setUserInfo] = useState<UserInfo>(emptyUserInfo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editField, setEditField] = useState<Field | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);

  const fetchMe = useCallback(async () => {
    if (!api) {
      setError('V2 API가 아직 설정되지 않았습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.profile.get();
      setUserInfo({
        name: data?.name ?? '',
        phone: formatPhone(data?.phone ?? ''),
        address: data?.address ?? '',
        addressDetail: data?.addressDetail ?? '',
      });
    } catch (requestError) {
      console.error('fetchAdminProfile error', requestError);
      setError('관리자 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const selectedAddress = route.params?.selectedAddress;
  const selectedAddressDetail = route.params?.selectedAddressDetail;

  useEffect(() => {
    if (!selectedAddress || !api) return;

    let active = true;

    const saveSelectedAddress = async () => {
      setAddressSaving(true);
      try {
        const payload = {
          address: selectedAddress,
          ...(selectedAddressDetail ? { addressDetail: selectedAddressDetail } : {}),
        };
        const data = await api.profile.update(payload);

        if (active) {
          setUserInfo(current => ({
            ...current,
            address: data?.address ?? selectedAddress,
            addressDetail: data?.addressDetail ?? selectedAddressDetail ?? current.addressDetail,
          }));
          void refreshProfile().catch(refreshError => {
            console.warn('refreshProfile after address update failed', refreshError);
          });
        }
      } catch (requestError) {
        console.error('saveAdminAddress error', requestError);
        if (active) Alert.alert('오류', '주소를 저장하지 못했습니다.');
      } finally {
        if (active) {
          setAddressSaving(false);
          navigation.setParams({ selectedAddress: undefined, selectedAddressDetail: undefined });
        }
      }
    };

    void saveSelectedAddress();

    return () => {
      active = false;
    };
  }, [api, navigation, refreshProfile, selectedAddress, selectedAddressDetail]);

  const beginEdit = (field: Field) => {
    setEditField(field);
    setEditValue(field === 'phone' ? userInfo.phone : userInfo.name);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editField) return;

    const trimmedValue = editValue.trim();
    if (editField === 'name' && !trimmedValue) {
      Alert.alert('입력 확인', '이름을 입력해 주세요.');
      return;
    }
    if (editField === 'phone' && cleanPhone(editValue).length < 10) {
      Alert.alert('입력 확인', '올바른 연락처를 입력해 주세요.');
      return;
    }
    const requestValue = editField === 'phone' ? cleanPhone(editValue) : trimmedValue;
    if (!api) {
      Alert.alert('설정 오류', 'V2 API가 아직 설정되지 않았습니다.');
      return;
    }
    setSaving(true);
    try {
      const data = await api.profile.update(
        editField === 'name' ? { name: requestValue } : { phone: requestValue },
      );

      if (editField === 'name') {
        setUserInfo(current => ({ ...current, name: data?.name ?? requestValue }));
      } else if (editField === 'phone') {
        setUserInfo(current => ({
          ...current,
          phone: formatPhone(data?.phone ?? requestValue),
        }));
      }

      void refreshProfile().catch(refreshError => {
        console.warn('refreshProfile after profile update failed', refreshError);
      });
      Alert.alert('변경 완료', `${editField === 'name' ? '이름' : '연락처'}가 변경되었습니다.`);
      setEditField(null);
      setEditValue('');
    } catch (requestError) {
      console.error('saveAdminProfile error', requestError);
      Alert.alert('오류', '정보를 변경하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('로그아웃', '관리자 계정에서 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const editTitle = editField === 'name' ? '이름 변경' : '연락처 변경';

  const headerAction = (
    <Pressable
      onPress={() => void fetchMe()}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="관리자 정보 새로고침"
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
      keyboardAware
      contentStyle={styles.screenContent}
      footer={
        <SafeAreaView edges={['bottom']} style={styles.navSafeArea}>
          <AdminBottomNav active="AdminSettings" />
        </SafeAreaView>
      }
    >
      <AppHeader title="관리자 설정" showBrand action={headerAction} />

      <View style={styles.body}>
        <PageIntro
          title="내 계정"
          description="관리자 프로필과 로그인 정보를 확인하고 변경하세요."
        />

        {loading && !userInfo.name ? (
          <StateView title="관리자 정보를 불러오는 중입니다" loading />
        ) : (
          <>
            {error ? (
              <View style={styles.inlineError} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                <Text style={styles.inlineErrorText}>{error}</Text>
                <Pressable
                  onPress={() => void fetchMe()}
                  accessibilityRole="button"
                  accessibilityLabel="관리자 정보 다시 불러오기"
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retryButtonText}>재시도</Text>
                </Pressable>
              </View>
            ) : null}

            <Card style={styles.profileCard} elevated>
              <View style={styles.avatar} accessibilityElementsHidden>
                <Text style={styles.avatarText}>{userInfo.name?.trim().charAt(0) || '관'}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{userInfo.name || '관리자'}</Text>
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.primaryDark} />
                  <Text style={styles.adminBadgeText}>관리자 계정</Text>
                </View>
              </View>
            </Card>

            <SectionTitle style={styles.sectionTitle}>기본 정보</SectionTitle>
            <Card style={styles.settingsCard}>
              <SettingRow
                icon="person-outline"
                title="이름"
                value={userInfo.name || '미등록'}
                onPress={() => beginEdit('name')}
              />
              <View style={styles.divider} />
              <SettingRow
                icon="call-outline"
                title="연락처"
                value={userInfo.phone || '미등록'}
                onPress={() => beginEdit('phone')}
              />
              <View style={styles.divider} />
              <SettingRow
                icon="location-outline"
                title="주소"
                value={
                  userInfo.address
                    ? [userInfo.address, userInfo.addressDetail].filter(Boolean).join(' ')
                    : '등록된 주소가 없습니다.'
                }
                actionLabel="검색"
                loading={addressSaving}
                onPress={() =>
                  navigation.navigate('AddressSearchScreen', { returnTo: 'AdminSettings' })
                }
              />
            </Card>

            <SectionTitle style={styles.sectionTitle}>보안</SectionTitle>
            <Card style={styles.capabilityCard}>
              <View style={styles.capabilityIcon}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.capabilityCopy}>
                <Text style={styles.capabilityTitle}>비밀번호 변경 준비 중</Text>
                <Text style={styles.capabilityDescription}>
                  V2 프로필 API에는 아직 비밀번호 변경 계약이 없습니다.
                </Text>
              </View>
            </Card>

            {editField ? (
              <Card style={styles.editorCard}>
                <View style={styles.editorHeader}>
                  <Text style={styles.editorTitle}>{editTitle}</Text>
                  <Pressable
                    onPress={cancelEdit}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={`${editTitle} 취소`}
                    style={({ pressed }) => [styles.editorClose, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <FormField
                  label={editField === 'phone' ? '연락처' : '이름'}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType={editField === 'phone' ? 'phone-pad' : 'default'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={
                    editField === 'phone' ? '010-0000-0000' : '이름 입력'
                  }
                  returnKeyType="done"
                  onSubmitEditing={() => void saveEdit()}
                />
                <View style={styles.editorActions}>
                  <Button
                    label="취소"
                    variant="ghost"
                    fullWidth={false}
                    disabled={saving}
                    onPress={cancelEdit}
                    style={styles.editorButton}
                  />
                  <Button
                    label="변경 저장"
                    icon="checkmark"
                    fullWidth={false}
                    loading={saving}
                    onPress={() => void saveEdit()}
                    style={styles.editorButton}
                  />
                </View>
              </Card>
            ) : null}

            <SectionTitle style={styles.sectionTitle}>세션</SectionTitle>
            <Card style={styles.sessionCard}>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionTitle}>관리자 로그아웃</Text>
                <Text style={styles.sessionDescription}>
                  모든 기기의 서버 세션을 종료하고 이 기기에 저장된 로그인 정보를 지웁니다.
                </Text>
              </View>
              <Button
                label="로그아웃"
                icon="log-out-outline"
                variant="danger"
                onPress={confirmLogout}
              />
            </Card>
          </>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl,
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
  body: {
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.xl,
  },
  inlineError: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineErrorText: {
    flex: 1,
    marginHorizontal: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
  retryButton: {
    minHeight: layout.minTouchTarget,
    minWidth: 60,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.danger,
  },
  profileCard: {
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 29,
    color: colors.white,
  },
  profileCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text,
  },
  adminBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminBadgeText: {
    marginLeft: spacing.xxs,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.primaryDark,
  },
  sectionTitle: {
    marginTop: spacing.md,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  capabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  capabilityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.disabledSoft,
  },
  capabilityCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  capabilityTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  capabilityDescription: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  settingRow: {
    minHeight: 82,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  settingCopy: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  settingTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  settingValue: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  changeButton: {
    minWidth: 62,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 40 + spacing.md,
    backgroundColor: colors.borderSoft,
  },
  editorCard: {
    marginTop: spacing.md,
    borderColor: colors.primary,
  },
  editorHeader: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  editorClose: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editorButton: {
    flex: 1,
  },
  sessionCard: {
    marginBottom: spacing.lg,
  },
  sessionCopy: {
    marginBottom: spacing.md,
  },
  sessionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  sessionDescription: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
