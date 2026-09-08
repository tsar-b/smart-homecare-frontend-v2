import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import type {
  AppCatalog,
  CatalogAsset,
  CatalogCategory,
  CatalogServiceType,
  CatalogSubtype,
  JsonObject,
  JsonValue,
  PricingTier,
  RequestOption,
} from '../domain';
import {
  RootStackParamList,
  ServiceType,
  Subtype,
  Tier,
} from '../navigation/AppNavigator';
import { colors, fonts, radius, shadow, spacing } from '../theme/tokens';
import { LatestRequest } from '../utils/latestRequest';

const BOOKING_STEPS = ['가전 선택', '서비스 선택', '제품 종류', '상세 옵션', '일정 확인'];

type SubtypeRoute = RouteProp<RootStackParamList, 'BookingSubtypeSelection'>;
type SubtypeNav = NativeStackNavigationProp<RootStackParamList>;
const SUBTYPE_ILLUSTRATIONS: Record<string, ImageSourcePropType> = {
  벽걸이형: require('../../asset/icons/byukgulyee-icon.png'),
  시스템에어컨: require('../../asset/icons/chungang4way-icon.png'),
  천장형: require('../../asset/icons/chungang1way-icon.png'),
  실외기: require('../../asset/icons/shiwaegi-icon.png'),
  스탠드형: require('../../asset/icons/standairconditioner-icon.png'),
  '2in1형': require('../../asset/icons/2in1-icon.png'),
};

const SERVICE_LABELS: Record<string, string> = {
  clean: '세척',
  install: '설치',
  fix: '수리',
  sell: '판매',
};

const PREVIEW_SUBTYPE_LABELS = [
  '벽걸이형',
  '스탠드형',
  '시스템에어컨',
  '천장형',
  '실외기',
  '2in1형',
] as const;

function createPreviewSubtypes(selectedServiceType: string, category: string): Subtype[] {
  const serviceLabel = SERVICE_LABELS[selectedServiceType] ?? '선택한 서비스';
  const previewService: ServiceType = {
    _id: `preview-service-${selectedServiceType}`,
    name: selectedServiceType,
    label: serviceLabel,
    tiers: [
      {
        id: `preview-tier-${selectedServiceType}-standard`,
        _id: `preview-tier-${selectedServiceType}-standard`,
        tier: 'standard',
        price: -1,
        memo: '디자인 미리보기용 상담 견적입니다. 실제 등급과 금액은 API 연결 후 표시됩니다.',
        assets: { blueprint: null, parts: [] },
      },
    ],
    options: [],
  };

  return PREVIEW_SUBTYPE_LABELS.map((name, index) => ({
    _id: `preview-subtype-${index + 1}`,
    name,
    category: { _id: `preview-category-${category}`, name: category },
    serviceOptions: [previewService],
  }));
}

const TIER_RANK: Readonly<Record<string, number>> = {
  basic: 0,
  standard: 1,
  deluxe: 2,
  premium: 3,
};

function asJsonRecord(value: JsonValue | undefined): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function identifier(value: JsonValue | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  const record = asJsonRecord(value);
  return record && typeof record.$oid === 'string' && record.$oid.trim()
    ? record.$oid
    : null;
}

function firstIdentifier(record: JsonObject, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = identifier(record[key]);
    if (value) return value;
  }
  return null;
}

function referenceTokens(value: JsonValue): readonly string[] {
  const direct = identifier(value);
  if (direct) return [direct];

  const record = asJsonRecord(value);
  if (!record) return [];
  const tokens = new Set<string>();
  for (const key of [
    'id',
    '_id',
    '$oid',
    'serviceTypeId',
    'service_type_id',
    'key',
    'name',
    'label',
  ]) {
    const token = identifier(record[key]);
    if (token) tokens.add(token);
  }
  return [...tokens];
}

function hasReference(values: readonly JsonValue[], candidates: ReadonlySet<string>): boolean {
  return values.some(value =>
    referenceTokens(value).some(token => candidates.has(token)),
  );
}

function serviceTokens(service: CatalogServiceType): ReadonlySet<string> {
  return new Set([service.id, service.key, service.label]);
}

function subtypeTokens(subtype: CatalogSubtype): ReadonlySet<string> {
  return new Set([subtype.id, subtype.key, subtype.label]);
}

function subtypeSupportsService(
  subtype: CatalogSubtype,
  service: CatalogServiceType,
): boolean {
  return hasReference(subtype.serviceOptions, serviceTokens(service));
}

function optionMatches(
  option: RequestOption,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
): boolean {
  const serviceIds = serviceTokens(service);
  const serviceMatch = option.serviceTypeId
    ? serviceIds.has(option.serviceTypeId)
    : hasReference(option.serviceTypes, serviceIds);
  return serviceMatch && hasReference(option.appliesTo, subtypeTokens(subtype));
}

function assetMatches(
  asset: CatalogAsset,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
  tier: PricingTier,
): boolean {
  return (
    asset.serviceType !== null &&
    serviceTokens(service).has(asset.serviceType) &&
    asset.subtype !== null &&
    subtypeTokens(subtype).has(asset.subtype) &&
    asset.tier !== null &&
    (asset.tier === tier.key || asset.tier === tier.label)
  );
}

function finiteNumber(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function adaptChoice(value: JsonValue): ServiceType['options'][number]['choices'][number] | null {
  const record = asJsonRecord(value);
  if (!record) return null;
  const label = typeof record.label === 'string' ? record.label : null;
  const choiceValue = typeof record.value === 'string' ? record.value : null;
  const extraCost = finiteNumber(record.extraCost) ?? finiteNumber(record.extra_cost);
  if (!label || !choiceValue || extraCost === null) return null;

  return {
    label,
    value: choiceValue,
    extraCost,
  };
}

function adaptOptions(
  catalog: AppCatalog,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
): ServiceType['options'] {
  return [...catalog.options]
    .filter(option => optionMatches(option, service, subtype))
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.label.localeCompare(right.label, 'ko') ||
        left.id.localeCompare(right.id),
    )
    .map(option => {
      const choices = option.choices
        .map(adaptChoice)
        .filter(
          (
            choice,
          ): choice is ServiceType['options'][number]['choices'][number] => choice !== null,
        );
      return choices.length > 0
        ? { _id: option.id, key: option.key, label: option.label, choices }
        : null;
    })
    .filter((option): option is ServiceType['options'][number] => option !== null);
}

function adaptTierAssets(
  catalog: AppCatalog,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
  pricing: PricingTier,
): Tier['assets'] {
  const matchingAssets = catalog.assets.filter(asset =>
    assetMatches(asset, service, subtype, pricing),
  );
  const blueprintUrls = [
    ...new Set(
      matchingAssets
        .filter(asset => asset.kind?.toLowerCase() === 'blueprint' && asset.url)
        .map(asset => asset.url as string),
    ),
  ];
  const seenParts = new Set<string>();
  const parts = matchingAssets
    .filter(asset => asset.kind?.toLowerCase() === 'part' && asset.url)
    .sort(
      (left, right) =>
        (left.label ?? '').localeCompare(right.label ?? '', 'ko') || left.id.localeCompare(right.id),
    )
    .flatMap(asset => {
      const url = asset.url as string;
      const identity = `${asset.partId ?? ''}\u0000${asset.label ?? ''}\u0000${url}`;
      if (seenParts.has(identity)) return [];
      seenParts.add(identity);
      return [
        {
          ...(asset.partId ? { partId: asset.partId } : {}),
          ...(asset.label ? { label: asset.label } : {}),
          url,
        },
      ];
    });

  return {
    // Conflicting duplicate blueprint rows are a catalog-integrity issue. Do not
    // choose one based on unstable database row order.
    blueprint: blueprintUrls.length === 1 ? blueprintUrls[0] : null,
    parts,
  };
}

function pricingMatches(
  pricing: PricingTier,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
): boolean {
  const serviceMatch = pricing.serviceTypeId
    ? serviceTokens(service).has(pricing.serviceTypeId)
    : pricing.serviceType !== null && serviceTokens(service).has(pricing.serviceType);
  return (
    serviceMatch &&
    pricing.subtype !== null &&
    subtypeTokens(subtype).has(pricing.subtype)
  );
}

function adaptPricingTiers(
  catalog: AppCatalog,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
): Tier[] {
  const matching = catalog.pricingTiers.filter(pricing =>
    pricingMatches(pricing, service, subtype),
  );
  const keyCounts = matching.reduce<Map<string, number>>((counts, pricing) => {
    const key = pricing.key.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());

  return matching
    // There is no composite uniqueness constraint in the migrated schema. A
    // duplicate tier key can carry a different price/ID, so silently choosing
    // either row could quote or submit the wrong product.
    .filter(pricing => keyCounts.get(pricing.key.toLowerCase()) === 1)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        (TIER_RANK[left.key.toLowerCase()] ?? Number.MAX_SAFE_INTEGER) -
          (TIER_RANK[right.key.toLowerCase()] ?? Number.MAX_SAFE_INTEGER) ||
        left.label.localeCompare(right.label, 'ko') ||
        left.id.localeCompare(right.id),
    )
    .map(pricing => ({
      id: pricing.id,
      _id: pricing.id,
      tier: pricing.key,
      price: pricing.basePrice,
      memo: pricing.memo ?? '',
      assets: adaptTierAssets(catalog, service, subtype, pricing),
    }));
}

function adaptNestedPart(
  value: JsonValue,
): ServiceType['tiers'][number]['assets']['parts'][number] | null {
  const record = asJsonRecord(value);
  if (!record || typeof record.url !== 'string' || !record.url) return null;
  const partId = firstIdentifier(record, ['partId', 'part_id', 'id', '_id']);
  const label = typeof record.label === 'string' && record.label ? record.label : null;
  return {
    ...(partId ? { partId } : {}),
    ...(label ? { label } : {}),
    url: record.url,
  };
}

function adaptNestedTier(value: JsonValue): Tier | null {
  const record = asJsonRecord(value);
  if (!record) return null;
  const tierKey = firstIdentifier(record, ['tier', 'key', 'label']);
  const price = finiteNumber(record.price) ?? finiteNumber(record.basePrice);
  if (!tierKey || price === null) return null;

  const rowId = firstIdentifier(record, ['id', '_id']);
  const assetsRecord = asJsonRecord(record.assets);
  const blueprint =
    assetsRecord && typeof assetsRecord.blueprint === 'string'
      ? assetsRecord.blueprint
      : null;
  const rawParts = assetsRecord?.parts;
  const parts = Array.isArray(rawParts)
    ? rawParts
        .map(adaptNestedPart)
        .filter(
          (
            part,
          ): part is ServiceType['tiers'][number]['assets']['parts'][number] => part !== null,
        )
    : [];

  return {
    ...(rowId ? { id: rowId, _id: rowId } : {}),
    tier: tierKey,
    price,
    memo: typeof record.memo === 'string' ? record.memo : '',
    assets: { blueprint, parts },
  };
}

function adaptNestedOption(value: JsonValue): ServiceType['options'][number] | null {
  const record = asJsonRecord(value);
  if (!record) return null;
  const rowId = firstIdentifier(record, ['id', '_id']);
  const key = firstIdentifier(record, ['key', 'name']);
  const label = typeof record.label === 'string' && record.label ? record.label : null;
  const rawChoices = record.choices;
  if (!rowId || !key || !label || !Array.isArray(rawChoices)) return null;

  const choices = rawChoices.map(adaptChoice);
  if (choices.length === 0 || choices.some(choice => choice === null)) return null;
  return {
    _id: rowId,
    key,
    label,
    choices: choices.filter(
      (
        choice,
      ): choice is ServiceType['options'][number]['choices'][number] => choice !== null,
    ),
  };
}

function adaptNestedService(
  value: JsonValue,
  service: CatalogServiceType,
): ServiceType | null {
  const record = asJsonRecord(value);
  if (!record || !referenceTokens(value).some(token => serviceTokens(service).has(token))) {
    return null;
  }

  const rawTiers = record.tiers;
  if (!Array.isArray(rawTiers)) return null;
  const parsedTiers = rawTiers.map(adaptNestedTier);
  if (parsedTiers.length === 0 || parsedTiers.some(tier => tier === null)) return null;

  const rawOptions = record.options;
  if (rawOptions !== undefined && !Array.isArray(rawOptions)) return null;
  const parsedOptions = Array.isArray(rawOptions) ? rawOptions.map(adaptNestedOption) : [];
  if (parsedOptions.some(option => option === null)) return null;

  return {
    _id: firstIdentifier(record, ['id', '_id']) ?? service.id,
    name: firstIdentifier(record, ['name', 'key']) ?? service.key,
    label:
      typeof record.label === 'string' && record.label ? record.label : service.label,
    tiers: parsedTiers.filter((tier): tier is Tier => tier !== null),
    options: parsedOptions.filter(
      (option): option is ServiceType['options'][number] => option !== null,
    ),
  };
}

export function adaptServiceForSubtype(
  catalog: AppCatalog,
  service: CatalogServiceType,
  subtype: CatalogSubtype,
): ServiceType | null {
  const hasExactNormalizedPair = catalog.pricingTiers.some(
    pricing => pricing.serviceTypeId === service.id && pricing.subtype === subtype.id,
  );
  if (!subtypeSupportsService(subtype, service) && !hasExactNormalizedPair) return null;

  const nestedService = subtype.serviceOptions
    .map(value => adaptNestedService(value, service))
    .find((value): value is ServiceType => value !== null);
  let tiers = adaptPricingTiers(catalog, service, subtype);
  const options = adaptOptions(catalog, service, subtype);

  if (tiers.length === 0) {
    // Canonical V2 requires a normalized pricing ID even for a consultation
    // quote (-1). Do not send users through a synthetic tier that cannot submit.
    return null;
  } else if (nestedService) {
    tiers = tiers.map(tier => {
      const nestedTier = nestedService.tiers.find(item => item.tier === tier.tier);
      if (!nestedTier) return tier;
      return {
        ...tier,
        assets: {
          blueprint: tier.assets.blueprint ?? nestedTier.assets.blueprint ?? null,
          parts: tier.assets.parts.length > 0 ? tier.assets.parts : nestedTier.assets.parts,
        },
      };
    });
  }

  return {
    _id: service.id,
    name: service.key,
    label: service.label,
    tiers,
    // V2 submits normalized option IDs. Unreconciled embedded legacy options
    // would display a choice that the server cannot price reliably.
    options,
  };
}

function categoryMatches(
  subtype: CatalogSubtype,
  category: string,
  categoryRow: CatalogCategory | undefined,
): boolean {
  if (!subtype.category) return false;
  return (
    subtype.category === category ||
    subtype.category === categoryRow?.id ||
    subtype.category === categoryRow?.key ||
    subtype.category === categoryRow?.label
  );
}

function adaptSubtype(
  catalog: AppCatalog,
  subtype: CatalogSubtype,
  category: string,
  categoryRow: CatalogCategory | undefined,
): Subtype | null {
  const services = catalog.serviceTypes
    .map(service => adaptServiceForSubtype(catalog, service, subtype))
    .filter((service): service is ServiceType => service !== null);
  if (services.length === 0) return null;

  return {
    _id: subtype.id,
    name: subtype.label,
    ...(subtype.iconUrl ? { iconUrl: subtype.iconUrl } : {}),
    category: categoryRow
      ? { _id: categoryRow.id, name: categoryRow.key }
      : subtype.category ?? category,
    serviceOptions: services,
  };
}

export default function BookingSubtypeSelect() {
  const navigation = useNavigation<SubtypeNav>();
  const route = useRoute<SubtypeRoute>();
  const { selectedServiceType, category = 'aircon', isPreview } = route.params;
  const { api, configurationError } = useAuth();
  const previewMode = Boolean(isPreview || (!api && configurationError));

  const [subtypes, setSubtypes] = useState<Subtype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readRequest = useRef(new LatestRequest());

  const loadSubtypes = useCallback(async () => {
    const request = readRequest.current.start();
    setLoading(true);
    setError(null);

    if (previewMode) {
      setSubtypes(createPreviewSubtypes(selectedServiceType, category));
      setLoading(false);
      return;
    }

    if (!api) {
      setSubtypes([]);
      setError('서비스 연결을 준비하고 있습니다.');
      setLoading(false);
      return;
    }

    try {
      const initialization = await api.catalog.initialize({ signal: request.signal });
      if (!request.isCurrent()) return;

      const { catalog } = initialization;
      const selectedService = catalog.serviceTypes.find(
        service =>
          service.id === selectedServiceType ||
          service.key === selectedServiceType ||
          service.label === selectedServiceType,
      );
      if (!selectedService) throw new Error('Selected service is missing from the V2 catalog');

      const categoryRow = catalog.categories.find(
        item => item.id === category || item.key === category || item.label === category,
      );
      const filtered = catalog.subtypes
        .filter(subtype => categoryMatches(subtype, category, categoryRow))
        .map(subtype => adaptSubtype(catalog, subtype, category, categoryRow))
        .filter((subtype): subtype is Subtype => subtype !== null)
        .filter(subtype =>
          subtype.serviceOptions.some(
            service =>
              service._id === selectedService.id || service.name === selectedService.key,
          ),
        )
        .sort(
          (left, right) =>
            left.name.localeCompare(right.name, 'ko') || left._id.localeCompare(right._id),
        );

      setSubtypes(filtered);
    } catch (loadError) {
      if (!request.isCurrent()) return;
      console.error('Failed to load subtypes:', loadError);
      setSubtypes([]);
      setError('제품 종류를 불러오지 못했습니다.');
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  }, [api, category, previewMode, selectedServiceType]);

  useEffect(() => {
    void loadSubtypes();
    return () => readRequest.current.cancel();
  }, [loadSubtypes]);

  const handleBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.replace('BookingServiceSelection', { category });

  const handleSelect = (subtype: Subtype) => {
    const service = subtype.serviceOptions.find(option =>
      option._id === selectedServiceType || option.name === selectedServiceType || option.label === selectedServiceType,
    );

    if (!service) {
      Alert.alert('오류', `${selectedServiceType} 서비스는 이 기기에서 지원되지 않습니다.`);
      return;
    }

    navigation.navigate('BookingExplanation', {
      subtype,
      serviceType: service,
      ...(previewMode ? { isPreview: true } : {}),
    });
  };

  const serviceLabel =
    subtypes
      .flatMap(subtype => subtype.serviceOptions)
      .find(
        service =>
          service._id === selectedServiceType || service.name === selectedServiceType,
      )?.label ??
    SERVICE_LABELS[selectedServiceType] ??
    '선택한 서비스';

  return (
    <AppScreen scroll padded={false}>
      <AppHeader title="서비스 예약" onBack={handleBack} />
      <View style={styles.content}>
        <ProgressSteps steps={BOOKING_STEPS} current={2} />
        <PageIntro
          title="에어컨 종류를 선택해 주세요"
          description={
            previewMode
              ? `${serviceLabel} 예약 화면에 사용되는 제품 형태와 기존 일러스트 배치를 살펴보세요.`
              : `${serviceLabel} 서비스가 필요한 제품 형태를 선택하면 상세 옵션을 확인할 수 있습니다.`
          }
        />

        {previewMode ? (
          <View style={styles.previewNotice} accessibilityRole="summary">
            <Ionicons name="eye-outline" size={20} color={colors.primary} />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>디자인 미리보기</Text>
              <Text style={styles.previewText}>
                기존 제품 명칭과 일러스트를 화면 검토용으로 표시합니다. 이 목록은 현재 제공 가능
                제품을 뜻하지 않으며 예약으로 전송되지 않습니다.
              </Text>
            </View>
          </View>
        ) : null}

        {loading ? (
          <StateView
            loading
            title="제품 종류를 불러오는 중이에요"
            message="선택한 서비스를 지원하는 제품을 확인하고 있습니다."
          />
        ) : error ? (
          <StateView
            icon="cloud-offline-outline"
            title="제품 종류를 불러오지 못했어요"
            message="네트워크 연결을 확인한 뒤 다시 시도해 주세요."
            actionLabel="다시 시도"
            onAction={() => void loadSubtypes()}
          />
        ) : subtypes.length === 0 ? (
          <StateView
            icon="snow-outline"
            title="선택할 수 있는 제품이 없어요"
            message="현재 이 서비스를 지원하는 제품 종류가 등록되어 있지 않습니다."
            actionLabel="다시 확인"
            onAction={() => void loadSubtypes()}
          />
        ) : (
          <View style={styles.grid}>
            {subtypes.map(subtype => {
              const illustration = SUBTYPE_ILLUSTRATIONS[subtype.name];
              return (
                <View key={subtype._id} style={styles.cell}>
                  <Pressable
                    onPress={() => handleSelect(subtype)}
                    accessibilityRole="button"
                    accessibilityLabel={subtype.name}
                    accessibilityHint="상세 옵션 선택 단계로 이동합니다"
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  >
                    <View style={styles.iconWrap}>
                      {illustration ? (
                        <Image
                          source={illustration}
                          resizeMode="contain"
                          accessible={false}
                          style={styles.illustration}
                        />
                      ) : (
                        <Ionicons name="snow-outline" size={36} color={colors.primary} />
                      )}
                    </View>
                    <Text style={styles.cardTitle}>{subtype.name}</Text>
                    <Text style={styles.cardDescription}>
                      {previewMode ? '화면 구성 예시' : `${serviceLabel} 서비스 가능`}
                    </Text>
                    <View style={styles.cardAction}>
                      <Text style={styles.cardActionText}>상세 옵션</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                    </View>
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
    minHeight: 220,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    ...shadow,
  },
  cardPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: '100%',
    height: 104,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  illustration: {
    width: 96,
    height: 78,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  cardDescription: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
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
});
