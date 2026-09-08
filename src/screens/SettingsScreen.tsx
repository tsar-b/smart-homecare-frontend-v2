import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../api';
import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  CustomerBottomNav,
  FormField,
  PageIntro,
  SectionTitle,
  StateView,
} from '../components';
import { useAuth } from '../context/AuthContext';
import type { UpdateProfileInput, UserProfile } from '../domain';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, spacing } from '../theme/tokens';

type SettingsNavigation = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
type SettingsRoute = RouteProp<RootStackParamList, 'Settings'>;
type EditableField = 'name' | 'phone';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function settingsErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'REQUEST_CANCELLED') return '';
    if (error.status === 401) return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
    if (error.code === 'NETWORK_ERROR') return '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
  }
  return '정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function providerLabel(provider: string | null): string {
  switch (provider) {
    case 'standard': return '이메일 계정';
    case 'guest': return '비회원 계정';
    case 'kakao': return '카카오 계정';
    case 'apple': return 'Apple 계정';
    default: return provider ? `${provider} 계정` : '계정 정보 없음';
  }
}

function displayPhone(phone: string | null): string {
  if (!phone) return '미등록';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

function SettingsScreen() {
  const navigation = useNavigation<SettingsNavigation>();
  const route = useRoute<SettingsRoute>();
  const {
    api,
    configurationError,
    currentUser,
    logout,
    refreshProfile,
  } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(currentUser);
  const [loading, setLoading] = useState(!currentUser);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [accountAction, setAccountAction] = useState<'logout' | null>(null);
  const savingFieldRef = useRef(false);

  const selectedAddress = route.params?.selectedAddress;
  const selectedAddressDetail = route.params?.selectedAddressDetail;

  useFocusEffect(
    useCallback(() => {
      if (selectedAddress) {
        setLoading(false);
        return undefined;
      }

      let active = true;
      setLoading(true);

      void refreshProfile()
        .then((fresh) => {
          if (!active || !fresh) return;
          setProfile(fresh);
          setError(null);
        })
        .catch((caught) => {
          if (active) setError(settingsErrorMessage(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [refreshProfile, selectedAddress]),
  );

  useEffect(() => {
    if (!selectedAddress) return;
    let active = true;
    const controller = new AbortController();

    const saveReturnedAddress = async () => {
      if (!api) {
        setError(configurationError ?? '서버 연결 설정이 필요합니다.');
        navigation.setParams({ selectedAddress: undefined, selectedAddressDetail: undefined });
        return;
      }

      setSavingAddress(true);
      setError(null);
      try {
        const updated = await api.profile.update(
          {
            address: selectedAddress,
            addressDetail: selectedAddressDetail?.trim() || '',
          },
          { signal: controller.signal },
        );
        if (!active) return;
        setProfile((current) => current ? { ...current, ...updated } : current);
      } catch (caught) {
        if (active) {
          const message = settingsErrorMessage(caught);
          if (message) setError(`주소를 저장하지 못했습니다. ${message}`);
        }
      } finally {
        if (active) {
          setSavingAddress(false);
          navigation.setParams({ selectedAddress: undefined, selectedAddressDetail: undefined });
        }
      }
    };

    void saveReturnedAddress();
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, configurationError, navigation, selectedAddress, selectedAddressDetail]);

  const startEditing = (field: EditableField) => {
    if (loading || savingFieldRef.current || savingAddress || accountAction) return;
    setEditing(field);
    setFieldError(null);
    setEditValue(field === 'name' ? profile?.name ?? '' : profile?.phone ?? '');
  };

  const cancelEditing = () => {
    if (savingFieldRef.current) return;
    setEditing(null);
    setEditValue('');
    setFieldError(null);
  };

  const saveField = async () => {
    if (savingFieldRef.current || savingAddress || accountAction) return;
    if (!api || !editing) {
      setFieldError(configurationError ?? '서버 연결 설정이 필요합니다.');
      return;
    }

    const trimmed = editValue.trim();
    if (editing === 'name' && trimmed.length < 2) {
      setFieldError('이름은 2자 이상 입력해 주세요.');
      return;
    }

    const phoneDigits = trimmed.replace(/\D/g, '');
    if (editing === 'phone' && (phoneDigits.length < 9 || phoneDigits.length > 11)) {
      setFieldError('연락처는 숫자 9~11자리로 입력해 주세요.');
      return;
    }

    const patch: UpdateProfileInput = editing === 'name'
      ? { name: trimmed }
      : { phone: phoneDigits };

    savingFieldRef.current = true;
    setSavingField(true);
    setFieldError(null);
    try {
      const updated = await api.profile.update(patch);
      setProfile((current) => current ? { ...current, ...updated } : current);
      setEditing(null);
      setEditValue('');
      // Keep the shared booking defaults and persisted session in sync with this edit.
      await refreshProfile().catch(() => null);
    } catch (caught) {
      setFieldError(settingsErrorMessage(caught));
    } finally {
      savingFieldRef.current = false;
      setSavingField(false);
    }
  };

  const handleLogout = async () => {
    setAccountAction('logout');
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (caught) {
      setError(settingsErrorMessage(caught));
      setAccountAction(null);
    }
  };

  if (loading && !profile) {
    return (
      <AppScreen padded={false} footer={<CustomerBottomNav active="Settings" />}>
        <AppHeader title="내 정보" showBrand />
        <StateView title="내 정보를 불러오는 중입니다" loading />
      </AppScreen>
    );
  }

  if (!profile) {
    return (
      <AppScreen padded={false} footer={<CustomerBottomNav active="Settings" />}>
        <AppHeader title="내 정보" showBrand />
        <StateView
          title="내 정보를 불러오지 못했습니다"
          message={error ?? configurationError ?? '로그인 상태를 확인해 주세요.'}
          icon="person-circle-outline"
          actionLabel="다시 시도"
          onAction={() => {
            setLoading(true);
            void refreshProfile()
              .then((fresh) => {
                if (fresh) setProfile(fresh);
                setError(null);
              })
              .catch((caught) => setError(settingsErrorMessage(caught)))
              .finally(() => setLoading(false));
          }}
        />
      </AppScreen>
    );
  }

  const fullAddress = [profile.address, profile.addressDetail].filter(Boolean).join(' ');

  return (
    <AppScreen padded={false} scroll footer={<CustomerBottomNav active="Settings" />} keyboardAware>
      <AppHeader title="내 정보" showBrand />
      <View style={styles.content}>
        <PageIntro
          title={`${profile.name ?? '고객'}님`}
          description="예약에 사용할 연락처와 방문 주소를 관리하세요."
        />

        {error ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Ionicons name="warning-outline" size={19} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="오류 메시지 닫기"
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ) : null}

        <SectionTitle>기본 정보</SectionTitle>
        <Card style={styles.sectionCard}>
          <SettingRow
            icon="person-outline"
            label="이름"
            value={profile.name ?? '미등록'}
            actionLabel="변경"
            disabled={loading || savingField || savingAddress || accountAction !== null}
            onPress={() => startEditing('name')}
          />
          {editing === 'name' ? (
            <EditPanel
              label="이름"
              value={editValue}
              onChange={setEditValue}
              error={fieldError}
              saving={savingField}
              onCancel={cancelEditing}
              onSave={() => void saveField()}
            />
          ) : null}

          <SettingRow
            icon="call-outline"
            label="연락처"
            value={displayPhone(profile.phone)}
            actionLabel="변경"
            disabled={loading || savingField || savingAddress || accountAction !== null}
            onPress={() => startEditing('phone')}
          />
          {editing === 'phone' ? (
            <EditPanel
              label="연락처"
              value={editValue}
              onChange={setEditValue}
              error={fieldError}
              saving={savingField}
              keyboardType="phone-pad"
              onCancel={cancelEditing}
              onSave={() => void saveField()}
            />
          ) : null}

          <SettingRow
            icon="location-outline"
            label="방문 주소"
            value={fullAddress || '미등록'}
            actionLabel={savingAddress ? '저장 중' : '변경'}
            disabled={loading || savingAddress || savingField || accountAction !== null}
            onPress={() => navigation.navigate('AddressSearchScreen', { returnTo: 'Settings' })}
          />
        </Card>

        <SectionTitle style={styles.sectionTitle}>계정</SectionTitle>
        <Card style={styles.sectionCard}>
          <SettingRow
            icon="key-outline"
            label="로그인 방식"
            value={providerLabel(profile.provider)}
          />
          {profile.email ? (
            <SettingRow icon="mail-outline" label="이메일" value={profile.email} />
          ) : null}
        </Card>

        <View style={styles.accountActions}>
          <Button
            label={profile.isGuest ? '비회원 세션 종료' : '로그아웃'}
            icon="log-out-outline"
            variant="ghost"
            loading={accountAction === 'logout'}
            disabled={accountAction !== null || savingField || savingAddress}
            onPress={() => void handleLogout()}
          />
          <Button
            label="계정 삭제 준비 중"
            icon="lock-closed-outline"
            variant="secondary"
            disabled
            onPress={() => undefined}
          />
          <Text style={styles.deleteHelp}>
            현재 앱에서는 계정 삭제를 제공하지 않습니다. 예약 및 운영 기록을 함께 처리하는
            서버 측 트랜잭션 삭제·익명화 절차가 준비된 뒤 활성화됩니다.
          </Text>
        </View>
      </View>
    </AppScreen>
  );
}

function SettingRow({
  icon,
  label,
  value,
  actionLabel,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  actionLabel?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}, ${value}${actionLabel ? `, ${actionLabel}` : ''}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.settingRow,
        pressed && onPress && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
      </View>
      {actionLabel ? (
        <View style={styles.rowAction}>
          <Text style={styles.rowActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

function EditPanel({
  label,
  value,
  onChange,
  error,
  saving,
  keyboardType = 'default',
  onCancel,
  onSave,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  saving: boolean;
  keyboardType?: 'default' | 'phone-pad';
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.editPanel}>
      <FormField
        label={`${label} 수정`}
        value={value}
        onChangeText={onChange}
        error={error ?? undefined}
        keyboardType={keyboardType}
        editable={!saving}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={onSave}
      />
      <View style={styles.editActions}>
        <Button label="취소" variant="ghost" fullWidth={false} disabled={saving} onPress={onCancel} style={styles.editButton} />
        <Button label="저장" fullWidth={false} loading={saving} onPress={onSave} style={styles.editButton} />
      </View>
    </View>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  sectionTitle: {
    marginTop: spacing.xl,
  },
  sectionCard: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  settingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowPressed: {
    opacity: 0.65,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rowCopy: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  rowLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  rowValue: {
    marginTop: 2,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  rowAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: spacing.xs,
  },
  rowActionText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  editPanel: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  editButton: {
    minWidth: 92,
  },
  accountActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  deleteHelp: {
    paddingHorizontal: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
