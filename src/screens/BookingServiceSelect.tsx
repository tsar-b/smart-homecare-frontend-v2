import { t, useLocale } from '../i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  AppScreen,
  PageIntro,
  ProgressSteps,
  StateView,
} from '../components';
import { useAuth } from '../context/AuthContext';
import type { CatalogServiceType, CatalogSubtype, JsonValue } from '../domain';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, shadow, spacing } from '../theme/tokens';
import { LatestRequest } from '../utils/latestRequest';

const BOOKING_STEPS = ['가전 선택', '서비스 선택', '제품 종류', '상세 옵션', '일정 확인'];

type SelRoute = RouteProp<RootStackParamList, 'BookingServiceSelection'>;
type SelNav = NativeStackNavigationProp<RootStackParamList>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SERVICE_PRESENTATION: Record<string, { icon: IconName; description: string }> = {
  clean: {
    icon: 'sparkles-outline',
    description: '내부 오염과 냄새를 깨끗하게 관리합니다.',
  },
  install: {
    icon: 'construct-outline',
    description: '설치 환경을 확인하고 안전하게 시공합니다.',
  },
  fix: {
    icon: 'build-outline',
    description: '제품 증상을 확인하고 필요한 수리를 진행합니다.',
  },
  sell: {
    icon: 'cart-outline',
    description: '제품 판매 서비스는 준비 중입니다.',
  },
};

const PREVIEW_SERVICES: readonly CatalogServiceType[] = [
  {
    id: 'preview-service-clean',
    categoryId: 'preview-category-aircon',
    key: 'clean',
    label: '세척',
    sortOrder: 0,
    metadata: {},
  },
  {
    id: 'preview-service-install',
    categoryId: 'preview-category-aircon',
    key: 'install',
    label: '설치',
    sortOrder: 1,
    metadata: {},
  },
  {
    id: 'preview-service-fix',
    categoryId: 'preview-category-aircon',
    key: 'fix',
    label: '수리',
    sortOrder: 2,
    metadata: {},
  },
  {
    id: 'preview-service-sell',
    categoryId: 'preview-category-aircon',
    key: 'sell',
    label: '판매',
    sortOrder: 3,
    metadata: {},
  },
];

function referenceTokens(value: JsonValue): readonly string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];

  const tokens = new Set<string>();
  for (const key of ['id', '_id', '$oid', 'serviceTypeId', 'service_type_id', 'key', 'name']) {
    const candidate = value[key];
    if (typeof candidate === 'string') tokens.add(candidate);
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      !Array.isArray(candidate) &&
      typeof candidate.$oid === 'string'
    ) {
      tokens.add(candidate.$oid);
    }
  }
  return [...tokens];
}

function subtypeSupportsService(
  subtype: CatalogSubtype,
  service: CatalogServiceType,
): boolean {
  return subtype.serviceOptions.some(option =>
    referenceTokens(option).some(token => token === service.id || token === service.key),
  );
}

export default function BookingServiceSelect() {
  useLocale();
  const navigation = useNavigation<SelNav>();
  const route = useRoute<SelRoute>();
  const { category } = route.params ?? {};
  const { api, configurationError } = useAuth();
  const isPreview = !api && Boolean(configurationError);

  const [services, setServices] = useState<readonly CatalogServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readRequest = useRef(new LatestRequest());

  const loadServices = useCallback(async () => {
    const request = readRequest.current.start();
    setLoading(true);
    setError(null);

    if (isPreview) {
      setServices(PREVIEW_SERVICES);
      setLoading(false);
      return;
    }

    if (!api) {
      setServices([]);
      setError('서비스 연결을 준비하고 있습니다.');
      setLoading(false);
      return;
    }

    try {
      const initialization = await api.catalog.initialize({ signal: request.signal });
      if (!request.isCurrent()) return;

      const { catalog } = initialization;
      const categoryRow = category
        ? catalog.categories.find(
            item => item.id === category || item.key === category || item.label === category,
          )
        : null;
      const matchingSubtypes = category
        ? catalog.subtypes.filter(
            subtype =>
              subtype.category === category ||
              subtype.category === categoryRow?.id ||
              subtype.category === categoryRow?.key ||
              subtype.category === categoryRow?.label,
          )
        : catalog.subtypes;
      const filteredServices = catalog.serviceTypes
        .filter(service => {
          if (!category) return true;
          const explicitlySupported = matchingSubtypes.some(subtype =>
            subtypeSupportsService(subtype, service),
          );
          if (matchingSubtypes.some(subtype => subtype.serviceOptions.length > 0)) {
            return explicitlySupported;
          }
          return Boolean(categoryRow && service.categoryId === categoryRow.id);
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.label.localeCompare(right.label, 'ko') ||
            left.id.localeCompare(right.id),
        );

      setServices(filteredServices);
    } catch (loadError) {
      if (!request.isCurrent()) return;
      console.error('Failed to load service types:', loadError);
      setServices([]);
      setError('서비스 목록을 불러오지 못했습니다.');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [api, category, isPreview]);

  useEffect(() => {
    void loadServices();
    return () => readRequest.current.cancel();
  }, [loadServices]);

  const handleBack = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.replace('BookingMenu');
  const handleSelect = (service: CatalogServiceType) =>
    navigation.navigate('BookingSubtypeSelection', {
      ...(category ? { category } : {}),
      selectedServiceType: service.key,
      ...(isPreview ? { isPreview: true } : {}),
    });

  const categoryLabel = category === 'aircon' ? t('에어컨') : t('선택한 가전');

  return (
    <AppScreen scroll padded={false}>
      <AppHeader title={t("서비스 예약")} onBack={handleBack} />
      <View style={styles.content}>
        <ProgressSteps steps={BOOKING_STEPS} current={1} />
        <PageIntro
          title={t("어떤 도움이 필요하세요?")}
          description={
            isPreview
              ? t('{category} 예약 화면의 서비스 선택 단계를 살펴보세요.', { category: t(categoryLabel) })
              : t('{category}에 필요한 서비스를 선택해 주세요.', { category: t(categoryLabel) })
          }
        />

        {isPreview ? (
          <View style={styles.previewNotice} accessibilityRole="summary">
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>{t("디자인 미리보기")}</Text>
              <Text style={styles.previewText}>
                {t("아래 항목은 기존 서비스 명칭을 사용한 화면 예시입니다. 실제 제공 범위와 가격은 API 연결 후 표시되며, 이 흐름에서는 예약이 접수되지 않습니다.")}</Text>
            </View>
          </View>
        ) : null}

        {loading ? (
          <StateView
            loading
            title={t("서비스를 불러오는 중이에요")}
            message={t("이용 가능한 항목을 확인하고 있습니다.")}
          />
        ) : error ? (
          <StateView
            icon="cloud-offline-outline"
            title={t("서비스를 불러오지 못했어요")}
            message={t("네트워크 연결을 확인한 뒤 다시 시도해 주세요.")}
            actionLabel={t("다시 시도")}
            onAction={() => void loadServices()}
          />
        ) : services.length === 0 ? (
          <StateView
            icon="file-tray-outline"
            title={t("이용 가능한 서비스가 없어요")}
            message={t("잠시 후 다시 확인하거나 이전 단계에서 다른 가전을 선택해 주세요.")}
            actionLabel={t("다시 확인")}
            onAction={() => void loadServices()}
          />
        ) : (
          <View style={styles.grid}>
            {services.map(service => {
              const isDisabled = service.key === 'sell';
              const presentation = SERVICE_PRESENTATION[service.key] ?? {
                icon: 'options-outline' as IconName,
                description: t('서비스 상세 내용을 다음 단계에서 확인할 수 있습니다.'),
              };

              return (
                <View key={service.id} style={styles.cell}>
                  <Pressable
                    onPress={() => !isDisabled && handleSelect(service)}
                    disabled={isDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={t(service.label)}
                    accessibilityHint={
                      isDisabled
                        ? t('현재 준비 중인 서비스입니다')
                        : t('제품 종류 선택 단계로 이동합니다')
                    }
                    accessibilityState={{ disabled: isDisabled }}
                    style={({ pressed }) => [
                      styles.card,
                      isDisabled && styles.cardDisabled,
                      pressed && !isDisabled && styles.cardPressed,
                    ]}
                  >
                    <View style={[styles.iconWrap, isDisabled && styles.iconWrapDisabled]}>
                      <Ionicons
                        name={presentation.icon}
                        size={28}
                        color={isDisabled ? colors.disabled : colors.primary}
                      />
                    </View>
                    <Text style={[styles.cardTitle, isDisabled && styles.textDisabled]}>
                      {t(service.label)}
                    </Text>
                    <Text style={[styles.cardDescription, isDisabled && styles.textDisabled]}>
                      {t(presentation.description)}
                    </Text>
                    {isDisabled ? (
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{t("준비 중")}</Text>
                      </View>
                    ) : (
                      <View style={styles.cardAction}>
                        <Text style={styles.cardActionText}>{t("선택")}</Text>
                        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  previewNotice: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  previewCopy: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  previewTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primaryDark,
  },
  previewText: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  cell: {
    width: '50%',
    minWidth: 148,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
    flexGrow: 1,
  },
  card: {
    minHeight: 218,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    ...shadow,
  },
  cardDisabled: {
    backgroundColor: colors.disabledSoft,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 52,
    height: 52,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  iconWrapDisabled: {
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  cardDescription: {
    minHeight: 57,
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  textDisabled: {
    color: colors.textMuted,
  },
  cardAction: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  cardActionText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
});
