import { Tabs } from 'expo-router';

import { colors, radius } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarItemStyle: {
          borderRadius: radius.sm,
          marginHorizontal: 4,
          marginVertical: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 7,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Главная', tabBarLabel: 'Главная' }} />
      <Tabs.Screen name="search" options={{ title: 'Каталог', tabBarLabel: 'Каталог' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Избранное', tabBarLabel: 'Избранное' }} />
      <Tabs.Screen name="assistant" options={{ title: 'ИИ-помощник', tabBarLabel: 'Помощник' }} />
    </Tabs>
  );
}
