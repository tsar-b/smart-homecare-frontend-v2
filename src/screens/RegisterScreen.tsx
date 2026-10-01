import { t, useLocale } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  FormField,
  PageIntro,
} from '../components';
import { customerSafeErrorMessage } from '../api';
import { createSubmissionLock } from '../auth/submissionLock';
import {
  registrationPasswordError,
  validateRegistrationFields,
  type RegistrationFieldErrors,
} from '../auth/validation';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function toMessage(error: unknown): string {
  return customerSafeErrorMessage(
    error,
    '등록하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.',
  );
}

export default function RegisterScreen({ navigation, route }: Props) {
  useLocale();
  const isGuest = route.params?.isGuest ?? false;
  const { registerAccount } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState(route.params?.selectedAddress ?? '');
  const [addressDetail, setAddressDetail] = useState(
    route.params?.selectedAddressDetail ?? '',
  );
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submissionLock = useRef(createSubmissionLock());

  useEffect(() => {
    if (route.params?.selectedAddress !== undefined) {
      setAddress(route.params.selectedAddress);
    }
    if (route.params?.selectedAddressDetail !== undefined) {
      setAddressDetail(route.params.selectedAddressDetail);
    }
  }, [route.params?.selectedAddress, route.params?.selectedAddressDetail]);

  const title = isGuest ? t('비회원 접수 정보') : t('회원가입');
  const description = isGuest
    ? t('방문 예약에 필요한 최소 정보만 받습니다.')
    : t('예약 확인과 주소 관리를 위한 계정을 만드세요.');

  const passwordStrength = useMemo(() => registrationPasswordError(password), [password]);

  if (isGuest) {
    return (
      <AppScreen padded={false}>
        <AppHeader title={t("비회원 접수")} onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <PageIntro
            title={t("비회원 접수는 준비 중입니다")}
            description={t("전화번호 소유 확인과 서버 측 검증이 완료되기 전에는 개인정보를 등록하거나 예약을 접수하지 않습니다.")}
          />
          <Card style={styles.formCard}>
            <View style={styles.unavailableRow} accessibilityRole="alert">
              <Ionicons name="shield-outline" size={22} color={colors.primary} />
              <Text style={styles.unavailableText}>
                {t("휴대전화 OTP 인증과 악용 방지 절차를 구현한 뒤 이 기능을 활성화합니다.")}</Text>
            </View>
            <Button
              label={t("로그인 화면으로 돌아가기")}
              variant="secondary"
              icon="arrow-back-outline"
              onPress={() => navigation.replace('Login')}
              style={styles.submit}
            />
          </Card>
        </View>
      </AppScreen>
    );
  }

  const validate = (): boolean => {
    const next = validateRegistrationFields({ name, phone, email, password, confirmPassword, agreed });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (isGuest) {
      setFormError('비회원 접수는 휴대전화 인증 기능이 준비될 때까지 사용할 수 없습니다.');
      return;
    }
    if (!validate()) return;
    if (!submissionLock.current.tryAcquire()) return;

    setPending(true);
    try {
      const result = await registerAccount({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.requiresEmailConfirmation) {
        Toast.show({
          type: 'info',
          text1: t('이메일 확인이 필요합니다'),
          text2: t('메일의 확인 링크를 연 뒤 로그인해 주세요.'),
        });
        navigation.replace('Login', {
          notice: '가입 이메일로 보낸 확인 링크를 연 뒤 로그인해 주세요.',
        });
        return;
      }
      Toast.show({
        type: 'success',
        text1: t('회원가입이 완료되었습니다'),
        text2: t('새 계정으로 로그인되었습니다.'),
      });
    } catch (error) {
      setFormError(toMessage(error));
    } finally {
      submissionLock.current.release();
      setPending(false);
    }
  };

  return (
    <AppScreen scroll keyboardAware padded={false}>
      <AppHeader title={title} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <PageIntro title={title} description={description} />

        <Card style={styles.formCard}>
          <FormField
            label={t("이름")}
            value={name}
            onChangeText={value => {
              setName(value);
              setFormError(null);
              setErrors(current => ({ ...current, name: undefined }));
            }}
            placeholder={t("이름 입력")}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            error={errors.name}
          />

          <FormField
            label={t("전화번호")}
            value={phone}
            onChangeText={value => {
              setPhone(formatPhone(value));
              setFormError(null);
              setErrors(current => ({ ...current, phone: undefined }));
            }}
            placeholder="010-0000-0000"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
            error={errors.phone}
          />

          {!isGuest ? (
            <>
              <FormField
                label={t("이메일")}
                value={email}
                onChangeText={value => {
                  setEmail(value);
                  setFormError(null);
                  setErrors(current => ({ ...current, email: undefined }));
                }}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                error={errors.email}
              />
              <FormField
                label={t("비밀번호")}
                value={password}
                onChangeText={value => {
                  setPassword(value);
                  setFormError(null);
                  setErrors(current => ({ ...current, password: undefined, confirm: undefined }));
                }}
                placeholder={t("영문과 숫자를 포함한 8자 이상")}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                helper={password ? passwordStrength ?? '사용 가능한 비밀번호입니다.' : undefined}
                error={errors.password}
              />
              <FormField
                label={t("비밀번호 확인")}
                value={confirmPassword}
                onChangeText={value => {
                  setConfirmPassword(value);
                  setFormError(null);
                  setErrors(current => ({ ...current, confirm: undefined }));
                }}
                placeholder={t("비밀번호 다시 입력")}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                error={errors.confirm}
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>{t("방문 주소")}</Text>
              <Pressable
                onPress={() =>
                  navigation.navigate('AddressSearchScreen', { returnTo: 'Register' })
                }
                accessibilityRole="button"
                accessibilityLabel={t("방문 주소 검색")}
                style={({ pressed }) => [
                  styles.addressButton,
                  errors.address && styles.addressButtonError,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <Text style={[styles.addressText, !address && styles.placeholder]} numberOfLines={2}>
                  {address || '주소를 검색해 주세요'}
                </Text>
                <Ionicons name="search-outline" size={19} color={colors.textMuted} />
              </Pressable>
              {errors.address ? <Text style={styles.fieldError}>{t(errors.address)}</Text> : null}
              <FormField
                label={t("상세 주소")}
                value={addressDetail}
                onChangeText={setAddressDetail}
                placeholder={t("동 · 호수 등 (선택)")}
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                returnKeyType="done"
              />
            </>
          )}

          <Pressable
            onPress={() => {
              setAgreed(value => !value);
              setFormError(null);
              setErrors(current => ({ ...current, terms: undefined }));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel={t("서비스 이용 및 개인정보 처리 동의")}
            style={({ pressed }) => [styles.consent, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
            </View>
            <Text style={styles.consentText}>
              {t("서비스 이용 및 예약 처리를 위한 개인정보 수집에 동의합니다.")}</Text>
          </Pressable>
          {errors.terms ? <Text style={styles.fieldError}>{t(errors.terms)}</Text> : null}

          {formError ? (
            <View style={styles.formError} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.formErrorText}>{t(formError)}</Text>
            </View>
          ) : null}

          <Button
            label={isGuest ? t('비회원 정보 등록') : t('계정 만들기')}
            onPress={() => void handleSubmit()}
            loading={pending}
            style={styles.submit}
          />
        </Card>

        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
          <Text style={styles.privacyText}>
            {t("입력한 정보는 계정 관리와 서비스 방문 예약에만 사용됩니다.")}</Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  formCard: {
    padding: spacing.xl,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  addressButton: {
    minHeight: 54,
    marginBottom: spacing.xxs,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  addressButtonError: {
    borderColor: colors.danger,
  },
  addressText: {
    flex: 1,
    marginHorizontal: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  placeholder: {
    color: colors.disabled,
  },
  fieldError: {
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
  consent: {
    minHeight: 48,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    marginRight: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  formError: {
    marginTop: spacing.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  formErrorText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  submit: {
    marginTop: spacing.lg,
  },
  privacyNote: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  privacyText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  unavailableText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.72,
  },
});
