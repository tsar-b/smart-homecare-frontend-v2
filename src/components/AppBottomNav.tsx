import { t, useLocale } from '../i18n';
import React from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { BottomNav } from './BottomNav';

type CustomerTab = 'Home' | 'History' | 'Settings';
type AdminTab = 'AdminDashboard' | 'AdminUsers' | 'AdminBookings' | 'AdminSettings';

export function CustomerBottomNav({ active }: { active: CustomerTab }) {
  useLocale();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  return (
    <BottomNav
      items={[
        {
          key: 'Home',
          label: t('홈'),
          icon: 'home-outline',
          activeIcon: 'home',
          active: active === 'Home',
          onPress: () => navigation.navigate('Home'),
        },
        {
          key: 'History',
          label: t('예약 내역'),
          icon: 'calendar-outline',
          activeIcon: 'calendar',
          active: active === 'History',
          onPress: () => navigation.navigate('History'),
        },
        {
          key: 'Settings',
          label: t('내 정보'),
          icon: 'person-outline',
          activeIcon: 'person',
          active: active === 'Settings',
          onPress: () => navigation.navigate('Settings'),
        },
      ]}
    />
  );
}

export function AdminBottomNav({ active }: { active: AdminTab }) {
  useLocale();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  return (
    <BottomNav
      items={[
        {
          key: 'AdminDashboard',
          label: t('현황'),
          icon: 'grid-outline',
          activeIcon: 'grid',
          active: active === 'AdminDashboard',
          onPress: () => navigation.navigate('AdminDashboard'),
        },
        {
          key: 'AdminUsers',
          label: t('고객'),
          icon: 'people-outline',
          activeIcon: 'people',
          active: active === 'AdminUsers',
          onPress: () => navigation.navigate('AdminUsers'),
        },
        {
          key: 'AdminBookings',
          label: t('예약'),
          icon: 'calendar-outline',
          activeIcon: 'calendar',
          active: active === 'AdminBookings',
          onPress: () => navigation.navigate('AdminBookings'),
        },
        {
          key: 'AdminSettings',
          label: t('설정'),
          icon: 'settings-outline',
          activeIcon: 'settings',
          active: active === 'AdminSettings',
          onPress: () => navigation.navigate('AdminSettings'),
        },
      ]}
    />
  );
}
