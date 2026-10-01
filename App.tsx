// App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { BrowserAuthProvider } from './src/auth/BrowserAuthContext';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('./asset/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./asset/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./asset/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./asset/fonts/Pretendard-Bold.otf'),
  });

  if (!fontsLoaded) {
    if (fontError) {
      return (
        <View style={styles.loading} accessibilityRole="alert">
          <Text style={{ color: colors.text, padding: 24, textAlign: 'center' }}>
            앱 글꼴을 불러오지 못했습니다. 앱을 완전히 닫은 뒤 다시 실행해 주세요.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="앱 준비 중">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <BrowserAuthProvider><AppNavigator /></BrowserAuthProvider>
        <Toast />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
