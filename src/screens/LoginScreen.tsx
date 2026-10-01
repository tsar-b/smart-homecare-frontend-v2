import { t, useLocale } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  Brand,
  Button,
  Card,
  FormField,
} from '../components';
import { customerSafeErrorMessage } from '../api';
import { createSubmissionLock } from '../auth/submissionLock';
import { isValidEmail } from '../auth/validation';
import { useBrowserAuth } from '../auth/BrowserAuthContext';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, spacing } from '../theme/tokens';

type LoginNavigation = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type LoginRoute = RouteProp<RootStackParamList, 'Login'>;

function toMessage(error: unknown): string {
  return customerSafeErrorMessage(
    error,
    '로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.',
  );
}

export default function LoginScreen() {
  useLocale();
  const navigation = useNavigation<LoginNavigation>();
  const route = useRoute<LoginRoute>();
  const { loginEmail, configurationError, sessionError } = useAuth();
  const browser = useBrowserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submissionLock = useRef(createSubmissionLock());
  const displayedError = error ?? sessionError;

  const emailError = useMemo(() => {
    if (!email || isValidEmail(email)) return undefined;
    return '이메일 형식을 확인해 주세요.';
  }, [email]);

  const handleLogin = async () => {
    if (browser.busy) return;
    if (!email.trim() || !password || emailError) {
      setError('이메일과 비밀번호를 정확히 입력해 주세요.');
      return;
    }
    if (!submissionLock.current.tryAcquire()) return;

    setPending(true);
    setError(null);
    try {
      await loginEmail(email, password);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      submissionLock.current.release();
      setPending(false);
    }
  };

  return (
    <AppScreen scroll keyboardAware contentStyle={styles.screen}>
      <Brand />

      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowIcon}>
            <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
          </View>
          <Text style={styles.eyebrow}>SMART HOMECARE 2.0</Text>
        </View>
        <Text style={styles.title}>{t('집 관리가\n더 단순해집니다')}</Text>
        <Text style={styles.description}>
          {t("필요한 서비스를 고르고, 가능한 시간을 예약하고, 진행 상태를 한곳에서 확인하세요.")}</Text>
      </View>

      {configurationError ? (
        <Card style={styles.previewCard}>
          <View style={styles.noticeRow}>
            <Ionicons name="construct-outline" size={20} color={colors.primary} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>{t("디자인 미리보기 모드")}</Text>
              <Text style={styles.noticeText}>
                {t("API 주소를 연결하면 로그인과 예약 데이터가 활성화됩니다.")}</Text>
            </View>
          </View>
          <Button
            label={t("디자인 데모 화면 보기")}
            variant="secondary"
            icon="eye-outline"
            onPress={() => navigation.navigate('Home')}
            style={styles.noticeButton}
          />
        </Card>
      ) : null}

      {route.params?.notice ? (
        <Card style={styles.previewCard}>
          <View style={styles.noticeRow} accessibilityRole="alert">
            <Ionicons name="mail-unread-outline" size={20} color={colors.primary} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>{t("이메일 확인이 필요합니다")}</Text>
              <Text style={styles.noticeText}>{t(route.params.notice)}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card elevated style={styles.loginCard}>
        <Text style={styles.cardTitle}>{t("로그인")}</Text>
        <Text style={styles.cardDescription}>{t("예약 내역과 등록 정보를 안전하게 불러옵니다.")}</Text>

        <FormField
          label={t("이메일")}
          value={email}
          onChangeText={value => {
            setEmail(value);
            setError(null);
          }}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          error={emailError}
        />
        <FormField
          label={t("비밀번호")}
          value={password}
          onChangeText={value => {
            setPassword(value);
            setError(null);
          }}
          placeholder={t("비밀번호 입력")}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void handleLogin()}
        />

        {displayedError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{t(displayedError)}</Text>
          </View>
        ) : null}

        <Button
          label={t("로그인")}
          onPress={() => void handleLogin()}
          loading={pending}
          disabled={Boolean(emailError) || browser.busy}
        />
        <Button label={t('비밀번호를 잊으셨나요?')} variant="ghost" disabled={pending || browser.busy || !browser.canRecover || Boolean(configurationError)} onPress={browser.openRecovery} />

        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>{t("처음 이용하시나요?")}</Text>
          <Pressable
            disabled={pending || browser.busy}
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
            accessibilityLabel={t("회원가입")}
            hitSlop={8}
          >
            <Text style={styles.registerLink}>{t("회원가입")}</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.guestAction}>
        <View style={styles.guestIcon}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.guestCopy}>
          <Text style={styles.guestTitle}>{t("비회원 접수 준비 중")}</Text>
          <Text style={styles.guestDescription}>
            {t("휴대전화 본인 인증과 서버 검증을 연결한 뒤 제공됩니다.")}</Text>
        </View>
        <Ionicons name="lock-closed-outline" size={19} color={colors.textMuted} />
      </Card>

      <View style={{ gap: spacing.sm }}>
        {browser.providers.map(provider => <Button key={provider}
          label={t(provider === 'kakao' ? '카카오로 계속' : provider === 'apple' ? 'Apple로 계속' : 'Google로 계속')}
          variant="secondary" disabled={pending || browser.busy} loading={browser.busy}
          onPress={() => void browser.startSocial(provider)} />)}
        {!browser.configurationLoading && !browser.configurationError && !browser.providers.length ? <Text style={styles.socialNote}>{t('이 환경에서는 소셜 로그인이 설정되지 않았습니다. 이메일로 로그인해 주세요.')}</Text> : null}
        {browser.configurationLoading ? <Text style={styles.socialNote}>{t('로그인 옵션을 확인하고 있습니다.')}</Text> : null}
        {browser.configurationError ? <>
          <Text accessibilityRole="alert" style={styles.errorText}>{t(browser.configurationError)}</Text>
          <Button label={t('로그인 옵션 다시 확인')} variant="secondary" onPress={browser.refreshConfiguration} disabled={pending || browser.busy} />
        </> : null}
        {browser.error ? <Text accessibilityRole="alert" style={styles.errorText}>{t(browser.error)}</Text> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  eyebrowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    color: colors.primary,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -1,
  },
  description: {
    marginTop: spacing.sm,
    maxWidth: 480,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  previewCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primarySoft,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeCopy: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  noticeTitle: {
    fontFamily: fonts.semibold,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeText: {
    marginTop: 2,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  noticeButton: {
    marginTop: spacing.md,
  },
  loginCard: {
    padding: spacing.xl,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
  },
  cardDescription: {
    marginTop: spacing.xxs,
    marginBottom: spacing.lg,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  errorText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  registerPrompt: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 14,
  },
  registerLink: {
    marginLeft: spacing.xs,
    fontFamily: fonts.semibold,
    color: colors.primary,
    fontSize: 14,
  },
  guestAction: {
    minHeight: 76,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  guestIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  guestCopy: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  guestTitle: {
    fontFamily: fonts.semibold,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  guestDescription: {
    marginTop: 2,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  socialNote: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
