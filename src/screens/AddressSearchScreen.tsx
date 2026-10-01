import { t, useLocale } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '../api';
import {
  AppHeader,
  AppScreen,
  Button,
  Card,
  FormField,
  PageIntro,
  StateView,
} from '../components';
import { useAuth } from '../context/AuthContext';
import type { AddressSearchResult } from '../domain';
import type { AddressReturnRoute, RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, layout, radius, spacing } from '../theme/tokens';

type AddressRoute = RouteProp<RootStackParamList, 'AddressSearchScreen'>;
type AddressNavigation = NativeStackNavigationProp<RootStackParamList, 'AddressSearchScreen'>;

function primaryAddress(item: AddressSearchResult): string {
  return item.addressName;
}

function secondaryAddress(item: AddressSearchResult): string | null {
  return item.lotAddress && item.lotAddress !== item.addressName ? item.lotAddress : null;
}

function addressKey(item: AddressSearchResult, index: number): string {
  return `${item.addressName}-${item.longitude ?? ''}-${item.latitude ?? ''}-${index}`;
}

function addressErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'REQUEST_CANCELLED') return '';
  if (error instanceof ApiError && error.code === 'KAKAO_NOT_CONFIGURED') {
    return '주소 검색 키가 아직 설정되지 않았습니다.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return '검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return '주소 검색 서버에 연결할 수 없습니다.';
  }
  return '주소를 검색하지 못했습니다. 검색어를 확인하고 다시 시도해 주세요.';
}

function returnAddress(
  navigation: AddressNavigation,
  returnTo: AddressReturnRoute,
  selectedAddress: string,
  selectedAddressDetail: string,
) {
  const params = { selectedAddress, selectedAddressDetail };
  switch (returnTo) {
    case 'Register':
      navigation.popTo('Register', params, { merge: true });
      break;
    case 'Settings':
      navigation.popTo('Settings', params, { merge: true });
      break;
    case 'AdminSettings':
      navigation.popTo('AdminSettings', params, { merge: true });
      break;
  }
}

function AddressSearchScreen() {
  useLocale();
  const navigation = useNavigation<AddressNavigation>();
  const { returnTo } = useRoute<AddressRoute>().params;
  const { api, configurationError } = useAuth();
  const activeSearch = useRef<AbortController | null>(null);
  const resultList = useRef<FlatList<AddressSearchResult>>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly AddressSearchResult[]>([]);
  const [selected, setSelected] = useState<AddressSearchResult | null>(null);
  const [detail, setDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => activeSearch.current?.abort(), []);

  const search = async () => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setError('도로명, 건물명 또는 지번을 2자 이상 입력해 주세요.');
      return;
    }
    if (!api) {
      setError(configurationError ?? '서버 연결 설정이 필요합니다.');
      return;
    }

    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setLoading(true);
    setHasSearched(true);
    setError(null);
    setSelected(null);
    setDetail('');
    setResults([]);

    try {
      const response = await api.address.search(normalizedQuery, { signal: controller.signal });
      if (controller.signal.aborted || activeSearch.current !== controller) return;
      const seen = new Set<string>();
      const unique = response.filter((item) => {
        const address = primaryAddress(item);
        if (!address || seen.has(address)) return false;
        seen.add(address);
        return true;
      });
      setResults(unique);
    } catch (caught) {
      if (controller.signal.aborted || activeSearch.current !== controller) return;
      const message = addressErrorMessage(caught);
      if (message) {
        setError(message);
        setResults([]);
      }
    } finally {
      if (activeSearch.current === controller) {
        activeSearch.current = null;
        setLoading(false);
      }
    }
  };

  const clearSearch = () => {
    activeSearch.current?.abort();
    activeSearch.current = null;
    setQuery('');
    setResults([]);
    setSelected(null);
    setDetail('');
    setError(null);
    setHasSearched(false);
    setLoading(false);
  };

  const confirm = () => {
    if (!selected) {
      setError('목록에서 주소를 먼저 선택해 주세요.');
      return;
    }
    returnAddress(navigation, returnTo, primaryAddress(selected), detail.trim());
  };

  const emptyState = (
    <StateView
      title={hasSearched ? t('검색 결과가 없습니다') : t('주소를 검색해 주세요')}
      message={
        hasSearched
          ? t('도로명과 건물번호를 함께 입력하면 더 정확하게 찾을 수 있습니다.')
          : t('도로명, 건물명 또는 지번으로 방문 주소를 찾을 수 있습니다.')
      }
      icon={hasSearched ? 'search-outline' : 'location-outline'}
    />
  );

  return (
    <AppScreen padded={false} keyboardAware>
      <AppHeader title={t("주소 검색")} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <PageIntro
          title={t("방문 주소 찾기")}
          description={t("검색 결과에서 기본 주소를 고른 뒤 상세주소를 입력하세요.")}
        />

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                if (error) setError(null);
              }}
              onSubmitEditing={() => void search()}
              placeholder={t("예: 테헤란로 123")}
              placeholderTextColor={colors.disabled}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={t("검색할 주소")}
              accessibilityHint={t("도로명, 건물명 또는 지번을 입력하세요")}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable
                onPress={clearSearch}
                accessibilityRole="button"
                accessibilityLabel={t("검색어 지우기")}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close-circle" size={20} color={colors.disabled} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => void search()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t("주소 검색")}
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && !loading && styles.pressed,
              loading && styles.disabled,
            ]}
          >
            <Ionicons name="search" size={19} color={colors.white} />
            <Text style={styles.searchButtonText}>{t("검색")}</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{t(error)}</Text>
          </View>
        ) : null}

        <View style={styles.resultsWrap}>
          {loading ? (
            <StateView title={t("주소를 검색하는 중입니다")} loading />
          ) : (
            <FlatList
              ref={resultList}
              data={results}
              keyExtractor={addressKey}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={selected ? (
                <Card style={styles.selectionCard} elevated>
                  <View style={styles.selectedHeading}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    <View style={styles.selectedCopy}>
                      <Text style={styles.selectedLabel}>{t("선택한 주소")}</Text>
                      <Text style={styles.selectedAddress}>{primaryAddress(selected)}</Text>
                    </View>
                  </View>
                  <FormField
                    label={t("상세주소")}
                    value={detail}
                    onChangeText={setDetail}
                    placeholder={t("동, 호수 등 (선택)")}
                    returnKeyType="done"
                    onSubmitEditing={confirm}
                    helper={t("상세주소가 없다면 비워 두어도 됩니다.")}
                  />
                  <Button
                    label={t("이 주소 사용")}
                    icon="arrow-forward"
                    onPress={confirm}
                    accessibilityHint={t("선택한 주소를 이전 화면에 적용합니다")}
                  />
                </Card>
              ) : null}
              ListEmptyComponent={emptyState}
              contentContainerStyle={[
                styles.resultsContent,
                results.length === 0 && styles.emptyResults,
              ]}
              renderItem={({ item }) => {
                const address = primaryAddress(item);
                const secondary = secondaryAddress(item);
                const picked = selected?.addressName === address;
                const building = item.buildingName;
                return (
                  <Pressable
                    onPress={() => {
                      if (!picked) setDetail('');
                      setSelected(item);
                      setError(null);
                      requestAnimationFrame(() => {
                        resultList.current?.scrollToOffset({ offset: 0, animated: true });
                      });
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={`${address}${secondary ? `, 지번 ${secondary}` : ''}`}
                    accessibilityState={{ selected: picked }}
                    style={({ pressed }) => [
                      styles.resultCard,
                      picked && styles.resultCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.locationIcon, picked && styles.locationIconSelected]}>
                      <Ionicons
                        name={picked ? 'checkmark' : 'location-outline'}
                        size={19}
                        color={picked ? colors.white : colors.primary}
                      />
                    </View>
                    <View style={styles.addressCopy}>
                      <Text style={styles.primaryAddress}>{address}</Text>
                      {secondary ? <Text style={styles.secondaryAddress}>{t("지번")}{secondary}</Text> : null}
                      {building ? <Text style={styles.buildingName}>{building}</Text> : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

      </View>
    </AppScreen>
  );
}

export default AddressSearchScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.horizontalPadding,
    paddingTop: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchBox: {
    minHeight: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  searchButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  searchButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.white,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
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
  resultsWrap: {
    flex: 1,
    minHeight: 180,
  },
  resultsContent: {
    paddingVertical: spacing.xxs,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  emptyResults: {
    flexGrow: 1,
  },
  resultCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  resultCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  locationIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  locationIconSelected: {
    backgroundColor: colors.primary,
  },
  addressCopy: {
    flex: 1,
  },
  primaryAddress: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  secondaryAddress: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  buildingName: {
    marginTop: 2,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.primaryDark,
  },
  selectionCard: {
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  selectedHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
  },
  selectedAddress: {
    marginTop: 2,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
