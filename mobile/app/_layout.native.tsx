import { Component, type ReactNode, Suspense } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritesProvider } from '../src/context/FavoritesContext';
import { sourceSnapshotProviderConfig } from '../src/lib/offlineCatalogDb';
import { colors } from '../src/theme';

function AppNavigator() {
  return (
    <FavoritesProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerBackTitle: 'Назад',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: '800' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="document/[id]" options={{ title: 'Документ' }} />
      </Stack>
    </FavoritesProvider>
  );
}

function SnapshotBootScreen() {
  return (
    <View style={styles.bootScreen}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.bootTitle}>Подготавливаем библиотеку документов</Text>
      <Text style={styles.bootText}>Первый запуск настраивает данные для чтения.</Text>
    </View>
  );
}

class SnapshotErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.bootScreen}>
          <Text style={styles.errorTitle}>Не удалось открыть библиотеку документов</Text>
          <Text style={styles.bootText}>
            Метаданные каталога доступны в веб-версии. На телефоне переустановите приложение из Expo
            Go после проверки локального пакета данных.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {Platform.OS === 'web' ? (
        <AppNavigator />
      ) : (
        <SnapshotErrorBoundary>
          <Suspense fallback={<SnapshotBootScreen />}>
            <SQLite.SQLiteProvider {...sourceSnapshotProviderConfig} useSuspense>
              <AppNavigator />
            </SQLite.SQLiteProvider>
          </Suspense>
        </SnapshotErrorBoundary>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 32,
  },
  bootTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorTitle: { color: colors.danger, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  bootText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
