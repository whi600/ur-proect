import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentCard, EmptyState, LoadingBlock, NoticeCard } from '../../src/components/Ui';
import { useFavorites } from '../../src/context/FavoritesContext';
import { loadDocuments } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';
import type { DocumentSummary } from '../../src/types/legal';

export default function FavoritesScreen() {
  const { error, ids, isReady } = useFavorites();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [notice, setNotice] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await loadDocuments();
    setDocuments(result.data);
    setNotice(result.notice);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadDocuments().then((result) => {
      if (!active) {
        return;
      }
      setDocuments(result.data);
      setNotice(result.notice);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const favoriteDocuments = documents.filter((document) => ids.includes(document.id));

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.title}>Избранное</Text>
          <Text style={styles.subtitle}>
            Выбранные карточки хранятся только локально на этом устройстве. Аккаунт и синхронизация
            пока не реализованы.
          </Text>
        </View>

        {error ? <NoticeCard tone="error" title="Локальное хранилище" message={error} /> : null}
        {notice ? <NoticeCard title="API недоступен" message={notice} /> : null}

        <View style={styles.actions}>
          <Text style={styles.count}>{ids.length} сохранено</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
          >
            <Text style={styles.refreshText}>Обновить</Text>
          </Pressable>
        </View>

        {!isReady || isLoading ? <LoadingBlock label="Загружаем избранное…" /> : null}
        {isReady && !isLoading && favoriteDocuments.length === 0 ? (
          <EmptyState
            title="Пока пусто"
            message="Откройте карточку документа и нажмите «В избранное»."
          />
        ) : null}
        {isReady && !isLoading ? (
          <View style={styles.cards}>
            {favoriteDocuments.map((document) => (
              <DocumentCard document={document} key={document.id} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  intro: { gap: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  actions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  count: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  refreshButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  refreshText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  cards: { gap: spacing.sm },
  pressed: { opacity: 0.65 },
});
