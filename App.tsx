// App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./asset/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./asset/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./asset/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./asset/fonts/Pretendard-Bold.otf'),
  });

  if (!fontsLoaded) {
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
        <AppNavigator />
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
