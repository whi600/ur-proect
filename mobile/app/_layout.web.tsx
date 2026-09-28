import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritesProvider } from '../src/context/FavoritesContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
