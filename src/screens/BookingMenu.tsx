import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader, AppScreen, PageIntro, ProgressSteps } from '../components';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, fonts, radius, shadow, spacing } from '../theme/tokens';

type BookingMenuNav = NativeStackNavigationProp<RootStackParamList>;
const BOOKING_STEPS = ['가전 선택', '서비스 선택', '제품 종류', '상세 옵션', '일정 확인'];

type Appliance = {
  key: string;
  label: string;
  description: string;
  illustration: ImageSourcePropType;
  disabled?: boolean;
};

const APPLIANCES: Appliance[] = [
  {
    key: 'aircon',
    label: '에어컨',
    description: '세척 · 설치 · 수리',
    illustration: require('../../asset/icons/aircon.png'),
  },
  {
    key: 'television',
    label: 'TV',
    description: '서비스 준비 중',
    illustration: require('../../asset/icons/television.png'),
    disabled: true,
  },
  {
    key: 'refrigerator',
    label: '냉장고',
    description: '서비스 준비 중',
    illustration: require('../../asset/icons/refrigerator.png'),
    disabled: true,
  },
  {
    key: 'washing-machine',
    label: '세탁기',
    description: '서비스 준비 중',
    illustration: require('../../asset/icons/washingmachine.png'),
    disabled: true,
  },
];

export default function BookingMenu() {
  const navigation = useNavigation<BookingMenuNav>();

  const handleBack = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  const handleSelect = (appliance: Appliance) => {
    if (appliance.disabled) return;
    navigation.navigate('BookingServiceSelection', { category: appliance.key });
  };

  return (
    <AppScreen scroll padded={false}>
      <AppHeader title="서비스 예약" onBack={handleBack} />
      <View style={styles.content}>
        <ProgressSteps steps={BOOKING_STEPS} current={0} />
        <PageIntro
          title="어떤 가전을 관리할까요?"
          description="서비스가 필요한 가전을 선택해 주세요. 이용 가능한 항목부터 순서대로 확대됩니다."
        />

        <View style={styles.grid}>
          {APPLIANCES.map(appliance => (
            <View key={appliance.key} style={styles.cell}>
              <Pressable
                onPress={() => handleSelect(appliance)}
                disabled={appliance.disabled}
                accessibilityRole="button"
                accessibilityLabel={appliance.label}
                accessibilityHint={
                  appliance.disabled
                    ? '현재 준비 중인 서비스입니다'
                    : '서비스 유형 선택 단계로 이동합니다'
                }
                accessibilityState={{ disabled: Boolean(appliance.disabled) }}
                style={({ pressed }) => [
                  styles.card,
                  appliance.disabled && styles.cardDisabled,
                  pressed && !appliance.disabled && styles.cardPressed,
                ]}
              >
                <View style={[styles.iconWrap, appliance.disabled && styles.iconWrapDisabled]}>
                  <Image
                    source={appliance.illustration}
                    resizeMode="contain"
                    accessible={false}
                    style={[styles.illustration, appliance.disabled && styles.illustrationDisabled]}
                  />
                </View>

                <View style={styles.cardCopy}>
                  <Text style={[styles.cardTitle, appliance.disabled && styles.textDisabled]}>
                    {appliance.label}
                  </Text>
                  <Text style={[styles.cardDescription, appliance.disabled && styles.textDisabled]}>
                    {appliance.description}
                  </Text>
                </View>

                {appliance.disabled ? (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>준비 중</Text>
                  </View>
                ) : (
                  <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
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
  cell: {
    width: '50%',
    minWidth: 148,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
    flexGrow: 1,
  },
  card: {
    minHeight: 214,
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
    width: '100%',
    height: 96,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySubtle,
    borderRadius: radius.md,
  },
  iconWrapDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  illustration: {
    width: 70,
    height: 70,
  },
  illustrationDisabled: {
    opacity: 0.46,
  },
  cardCopy: {
    minHeight: 55,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.text,
  },
  cardDescription: {
    marginTop: spacing.xxs,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  textDisabled: {
    color: colors.textMuted,
  },
  statusPill: {
    alignSelf: 'flex-start',
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
