import { t, useLocale } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  ChoiceChip,
  FormField,
  PageIntro,
  ProgressSteps,
  SectionTitle,
} from '../components';
import type {
  RootStackParamList,
  SelectedOption,
} from '../navigation/AppNavigator';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { formatBookingPrice } from '../utils/bookingTime';

type ExplanationRoute = RouteProp<RootStackParamList, 'BookingExplanation'>;
type ExplanationNavigation = NativeStackNavigationProp<RootStackParamList>;

const BOOKING_STEPS = ['가전 선택', '서비스 선택', '제품 종류', '상세 옵션', '일정 확인'];

function formatPrice(value: number): string {
  return formatBookingPrice(value);
}

function isRemoteImage(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export default function BookingExplanation() {
  useLocale();
  const route = useRoute<ExplanationRoute>();
  const navigation = useNavigation<ExplanationNavigation>();
  const { serviceType, subtype, isPreview = false } = route.params;

  const [selectedTierKey, setSelectedTierKey] = useState(serviceType.tiers[0]?.tier ?? '');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, SelectedOption>>({});
  const [symptom, setSymptom] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [partImageFailed, setPartImageFailed] = useState(false);

  const currentTier = useMemo(
    () => serviceType.tiers.find(item => item.tier === selectedTierKey) ?? null,
    [selectedTierKey, serviceType.tiers],
  );

  useEffect(() => {
    const firstPart = currentTier?.assets?.parts?.[0];
    setSelectedPartId(firstPart?.partId ?? firstPart?.url ?? null);
    setPartImageFailed(false);
  }, [currentTier]);

  const selectedPart = useMemo(
    () =>
      currentTier?.assets?.parts?.find(
        part => (part.partId ?? part.url) === selectedPartId,
      ) ?? null,
    [currentTier, selectedPartId],
  );

  const requiredOptions = useMemo(
    () => (serviceType.options ?? []).filter(option => option.choices.length > 0),
    [serviceType.options],
  );

  const estimate = useMemo(() => {
    if (isPreview || !currentTier || currentTier.price === -1) return null;
    return (
      currentTier.price +
      Object.values(selectedOptions).reduce((sum, item) => sum + item.extraCost, 0)
    );
  }, [currentTier, isPreview, selectedOptions]);

  const blueprintValue = currentTier?.assets?.blueprint ?? null;

  const handleConfirm = () => {
    if (!currentTier) {
      setValidationError('이용 가능한 요금제가 없습니다. 이전 단계에서 다른 서비스를 선택해 주세요.');
      return;
    }

    const missing = requiredOptions.find(option => !selectedOptions[option.key]);
    if (missing) {
      setValidationError(t('‘{option}’ 옵션을 선택해 주세요.', { option: missing.label }));
      return;
    }

    setValidationError(null);
    navigation.navigate('Confirm', {
      serviceType,
      subtype,
      tier: currentTier,
      selectedOptions: requiredOptions.map(option => selectedOptions[option.key]),
      symptom: serviceType.name === 'fix' ? symptom.trim() : undefined,
      ...(isPreview ? { isPreview: true } : {}),
    });
  };

  return (
    <AppScreen scroll padded={false}>
      <AppHeader title={t("서비스 상세")} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <ProgressSteps steps={BOOKING_STEPS} current={3} />
        <PageIntro
          title={`${t(subtype.name)} ${t(serviceType.label)}`}
          description={
            isPreview
              ? t('상세 화면 구성을 확인하세요. 등급, 금액, 작업 범위는 실제 운영 데이터가 아닙니다.')
              : t('관리 범위와 선택 옵션을 확인하세요. 금액은 접수 시 서버에서 다시 계산됩니다.')
          }
        />

        {isPreview ? (
          <View style={styles.previewNotice} accessibilityRole="summary">
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>{t("디자인 미리보기 · 상담 견적만 표시")}</Text>
              <Text style={styles.previewText}>
                {t("API가 연결되지 않아 실제 가격, 도면, 옵션을 표시하지 않습니다. 다음 일정 화면도 확인할 수 있지만 예약은 접수되지 않습니다.")}</Text>
            </View>
          </View>
        ) : null}

        <SectionTitle>{t("서비스 등급")}</SectionTitle>
        {serviceType.tiers.length > 0 ? (
          <View style={styles.tierGrid} accessibilityRole="radiogroup">
            {serviceType.tiers.map(item => {
              const active = item.tier === selectedTierKey;
              return (
                <Pressable
                  key={item.id ?? item._id ?? item.tier}
                  onPress={() => {
                    setSelectedTierKey(item.tier);
                    setValidationError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.tier}, ${formatPrice(isPreview ? -1 : item.price)}`}
                  accessibilityState={{ checked: active }}
                  style={({ pressed }) => [
                    styles.tierCard,
                    active && styles.tierCardActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.tierIcon, active && styles.tierIconActive]}>
                    <Ionicons
                      name={active ? 'checkmark' : 'layers-outline'}
                      size={18}
                      color={active ? colors.white : colors.primary}
                    />
                  </View>
                  <Text style={[styles.tierName, active && styles.tierNameActive]}>
                    {item.tier.toUpperCase()}
                  </Text>
                  <Text style={[styles.tierPrice, active && styles.tierPriceActive]}>
                    {formatPrice(isPreview ? -1 : item.price)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="information-circle-outline" size={22} color={colors.warning} />
            <Text style={styles.emptyText}>{t("등록된 서비스 등급이 없습니다.")}</Text>
          </Card>
        )}

        {currentTier?.memo ? (
          <View style={styles.memo}>
            <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.memoText}>{currentTier.memo}</Text>
          </View>
        ) : null}

        {blueprintValue ? (
          <View style={styles.section}>
            <SectionTitle>{t("작업 범위 도면")}</SectionTitle>
            <Card style={styles.mediaCard}>
              {isRemoteImage(blueprintValue) ? (
                <Image
                  source={{ uri: blueprintValue }}
                  resizeMode="contain"
                  style={styles.blueprint}
                  accessibilityLabel={t('{product} {tier} 작업 범위 도면', { product: t(subtype.name), tier: t(currentTier?.tier ?? '') })}
                />
              ) : (
                <View style={styles.blueprintPlaceholder}>
                  <View style={styles.placeholderIcon}>
                    <Ionicons name="map-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.placeholderTitle}>{t("수작업 도면 원본 연결 대기")}</Text>
                  <Text style={styles.placeholderText}>
                    {t('도면 원본을 찾지 못했습니다. 파일이 복구되면 이 영역에 표시됩니다.')}</Text>
                </View>
              )}
            </Card>
          </View>
        ) : null}

        {currentTier?.assets?.parts?.length ? (
          <View style={styles.section}>
            <SectionTitle>{t("관리 부위")}</SectionTitle>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {currentTier.assets.parts.map(part => {
                const key = part.partId ?? part.url;
                return (
                  <ChoiceChip
                    key={key}
                    label={part.label || '관리 부위'}
                    selected={selectedPartId === key}
                    onPress={() => {
                      setSelectedPartId(key);
                      setPartImageFailed(false);
                    }}
                  />
                );
              })}
            </View>

            {selectedPart ? (
              <Card style={styles.partPreview}>
                {isRemoteImage(selectedPart.url) && !partImageFailed ? (
                  <Image
                    source={{ uri: selectedPart.url }}
                    resizeMode="cover"
                    style={styles.partImage}
                    onError={() => setPartImageFailed(true)}
                    accessibilityLabel={t('{part} 작업 예시', { part: t(selectedPart.label ?? '선택한 부위') })}
                  />
                ) : (
                  <View style={styles.partFallback}>
                    <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.partFallbackText}>{t("작업 예시 이미지를 준비 중입니다.")}</Text>
                  </View>
                )}
                <Text style={styles.partCaption}>
                  {selectedPart.label || '선택한 부위'} {t("관리 예시")}</Text>
              </Card>
            ) : null}
          </View>
        ) : null}

        {requiredOptions.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>{t("추가 옵션")}</SectionTitle>
            {requiredOptions.map(option => (
              <Card key={option._id} style={styles.optionCard}>
                <Text style={styles.optionLabel}>{t(option.label)}</Text>
                <View style={styles.optionChoices} accessibilityRole="radiogroup">
                  {option.choices.map(choice => {
                    const selected =
                      selectedOptions[option.key]?.selectedValue === choice.value;
                    return (
                      <Pressable
                        key={choice.value}
                        onPress={() => {
                          setSelectedOptions(current => ({
                            ...current,
                            [option.key]: {
                              _id: option._id,
                              key: option.key,
                              label: option.label,
                              selectedLabel: choice.label,
                              selectedValue: choice.value,
                              extraCost: choice.extraCost,
                            },
                          }));
                          setValidationError(null);
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={t('{option}, {price} 추가', { option: t(choice.label), price: formatPrice(choice.extraCost) })}
                        accessibilityState={{ checked: selected }}
                        style={({ pressed }) => [
                          styles.optionChoice,
                          selected && styles.optionChoiceSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.optionCopy}>
                          <Text
                            style={[
                              styles.optionChoiceLabel,
                              selected && styles.optionChoiceLabelSelected,
                            ]}
                          >
                            {t(choice.label)}
                          </Text>
                          <Text style={styles.optionPrice}>
                            {choice.extraCost === 0
                              ? t('추가 금액 없음')
                              : `+${formatPrice(choice.extraCost)}`}
                          </Text>
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={selected ? colors.primary : colors.border}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {serviceType.name === 'fix' ? (
          <View style={styles.section}>
            <FormField
              label={t("고장 증상")}
              value={symptom}
              onChangeText={setSymptom}
              placeholder={t("예: 냉방이 약하거나 실내기에서 물이 새요.")}
              multiline
              maxLength={2000}
              helper={t('{count}/2000자 · 증상을 자세히 적으면 상담이 빨라집니다.', { count: symptom.length })}
            />
          </View>
        ) : null}

        <Card style={styles.estimateCard}>
          <View style={styles.estimateRow}>
            <View>
              <Text style={styles.estimateLabel}>
                {isPreview ? t('미리보기 견적') : t('현재 예상 금액')}
              </Text>
              <Text style={styles.estimateHelp}>
                {isPreview
                  ? t('실제 가격은 API 연결 후 확인됩니다.')
                  : t('최종 금액은 서버 기준으로 확정됩니다.')}
              </Text>
            </View>
            <Text style={styles.estimateValue}>
              {estimate === null ? t('상담 필요') : formatPrice(estimate)}
            </Text>
          </View>
        </Card>

        {validationError ? (
          <View style={styles.validation} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.validationText}>{t(validationError)}</Text>
          </View>
        ) : null}

        <Button
          label={isPreview ? t('일정 화면 미리보기') : t('일정 선택으로 이동')}
          icon="calendar-outline"
          onPress={handleConfirm}
          style={styles.submit}
        />
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
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xxs,
  },
  tierCard: {
    minWidth: 132,
    minHeight: 126,
    flexBasis: '30%',
    flexGrow: 1,
    margin: spacing.xxs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  tierCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  tierIcon: {
    width: 34,
    height: 34,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
  },
  tierIconActive: {
    backgroundColor: colors.primary,
  },
  tierName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  tierNameActive: {
    color: colors.primaryDark,
  },
  tierPrice: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  tierPriceActive: {
    color: colors.primary,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    marginLeft: spacing.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  memo: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  memoText: {
    flex: 1,
    marginLeft: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.warning,
  },
  section: {
    marginTop: spacing.xl,
  },
  mediaCard: {
    padding: spacing.sm,
  },
  blueprint: {
    width: '100%',
    height: 310,
    borderRadius: radius.md,
  },
  blueprintPlaceholder: {
    minHeight: 210,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
  },
  placeholderIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
  },
  placeholderTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  placeholderText: {
    marginTop: spacing.xs,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  partPreview: {
    padding: spacing.sm,
  },
  partImage: {
    width: '100%',
    height: 210,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  partFallback: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  partFallbackText: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  partCaption: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionCard: {
    marginBottom: spacing.sm,
  },
  optionLabel: {
    marginBottom: spacing.sm,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  optionChoices: {
    gap: spacing.xs,
  },
  optionChoice: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  optionChoiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  optionCopy: {
    flex: 1,
  },
  optionChoiceLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  optionChoiceLabelSelected: {
    fontFamily: fonts.semibold,
    color: colors.primaryDark,
  },
  optionPrice: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  estimateCard: {
    marginTop: spacing.lg,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySubtle,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estimateLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  estimateHelp: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  estimateValue: {
    marginLeft: spacing.md,
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.primaryDark,
  },
  validation: {
    marginTop: spacing.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  validationText: {
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
  pressed: {
    opacity: 0.78,
  },
});
