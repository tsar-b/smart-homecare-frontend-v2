import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Brand } from '../components';
import { useAuth } from '../context/AuthContext';
import AddressSearchScreen from '../screens/AddressSearchScreen';
import AdminBookingList from '../screens/admin/AdminBookingList';
import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminSettings from '../screens/admin/AdminSettings';
import AdminUsers from '../screens/admin/AdminUsers';
import BookingConfirm from '../screens/BookingConfirm';
import BookingDetail from '../screens/BookingDetailScreen';
import BookingExplanation from '../screens/BookingExplanation';
import BookingMenu from '../screens/BookingMenu';
import BookingServiceSelection from '../screens/BookingServiceSelect';
import BookingSubtypeSelection from '../screens/BookingSubtypeSelect';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors, fonts, spacing } from '../theme/tokens';

export interface AssetPart {
  partId?: string;
  label?: string;
  url: string;
}

export interface Tier {
  id?: string;
  _id?: string;
  tier: string;
  price: number;
  memo: string;
  assets: {
    blueprint?: string | null;
    parts: AssetPart[];
  };
}

export interface Choice {
  label: string;
  value: string;
  extraCost: number;
}

export interface Option {
  _id: string;
  key: string;
  label: string;
  choices: Choice[];
}

export interface ServiceType {
  _id: string;
  name: string;
  label: string;
  tiers: Tier[];
  options: Option[];
}

export interface Subtype {
  _id: string;
  name: string;
  iconUrl?: string;
  category: { _id: string; name: string } | string;
  serviceOptions: ServiceType[];
}

export interface SelectedOption {
  _id: string;
  key: string;
  label: string;
  selectedLabel: string;
  selectedValue: string;
  extraCost: number;
}

export interface BookingPayload {
  serviceType: ServiceType;
  subtype: Subtype;
  tier: Tier;
  selectedOptions: SelectedOption[];
  symptom?: string;
}

export type AddressReturnRoute = 'Register' | 'Settings' | 'AdminSettings';

type AddressResultParams = {
  selectedAddress?: string;
  selectedAddressDetail?: string;
};

export type RootStackParamList = {
  Login: { notice?: string } | undefined;
  Register: ({ isGuest?: boolean } & AddressResultParams) | undefined;
  Home: { isGuest?: boolean } | undefined;
  Confirm: {
    serviceType: ServiceType;
    subtype: Subtype;
    tier: Tier;
    selectedOptions: SelectedOption[];
    symptom?: string;
    isPreview?: boolean;
  };
  History: undefined;
  Settings: AddressResultParams | undefined;
  BookingMenu: { isGuest?: boolean } | undefined;
  BookingExplanation: { subtype: Subtype; serviceType: ServiceType; isPreview?: boolean };
  BookingServiceSelection: { category: string } | undefined;
  BookingSubtypeSelection: {
    category?: string;
    selectedServiceType: string;
    isPreview?: boolean;
  };
  AddressSearchScreen: { returnTo: AddressReturnRoute };
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminBookings: undefined;
  AdminSettings: AddressResultParams | undefined;
  BookingDetail: { bookingId: string; viewMode?: 'customer' | 'admin' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.borderSoft,
    notification: colors.danger,
  },
};

function LoadingScreen() {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="앱 준비 중">
      <Brand />
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      <Text style={styles.loadingText}>안전하게 정보를 불러오고 있어요</Text>
    </View>
  );
}

export default function AppNavigator() {
  const { token, currentUser, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  const isAdmin = Boolean(token && currentUser?.isAdmin);
  const isSignedIn = Boolean(token);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        id={undefined}
        initialRouteName={isAdmin ? 'AdminDashboard' : isSignedIn ? 'Home' : 'Login'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {isAdmin ? (
          <Stack.Group navigationKey="admin">
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="AdminUsers" component={AdminUsers} />
            <Stack.Screen name="AdminBookings" component={AdminBookingList} />
            <Stack.Screen name="AdminSettings" component={AdminSettings} />
            <Stack.Screen name="BookingDetail" component={BookingDetail} />
            <Stack.Screen name="AddressSearchScreen" component={AddressSearchScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey={isSignedIn ? 'customer' : 'preview'}>
            {!isSignedIn ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            ) : null}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="BookingMenu" component={BookingMenu} />
            <Stack.Screen name="BookingServiceSelection" component={BookingServiceSelection} />
            <Stack.Screen name="BookingSubtypeSelection" component={BookingSubtypeSelection} />
            <Stack.Screen name="BookingExplanation" component={BookingExplanation} />
            <Stack.Screen name="Confirm" component={BookingConfirm} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="BookingDetail" component={BookingDetail} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="AddressSearchScreen" component={AddressSearchScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  spinner: {
    marginTop: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
