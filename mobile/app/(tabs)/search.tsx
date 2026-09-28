import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentCard, EmptyState, LoadingBlock, NoticeCard } from '../../src/components/Ui';
import { loadDocuments, searchDocuments } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';
import type { DocumentSummary } from '../../src/types/legal';

export default function SearchScreen() {
  const { q: queryFromHome } = useLocalSearchParams<{ q?: string | string[] }>();
  const initialQuery = Array.isArray(queryFromHome)
    ? (queryFromHome[0] ?? '')
    : (queryFromHome ?? '');

  return <SearchCatalog initialQuery={initialQuery} key={initialQuery} />;
}

function SearchCatalog({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const sourceSnapshotCount = documents.filter(
    (document) => document.content_state === 'source_snapshot',
  ).length;
  const hasSourceSnapshot = sourceSnapshotCount > 0;

  const runSearch = useCallback(async (value: string) => {
    setIsLoading(true);
    const trimmed = value.trim();
    if (trimmed) {
      const result = await searchDocuments(trimmed);
      setDocuments(result.data.results);
      setNotice(result.notice);
    } else {
      const result = await loadDocuments();
      setDocuments(result.data);
      setNotice(result.notice);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      void runSearch(query);
    }, 250);
    return () => clearTimeout(debounce);
  }, [query, runSearch]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardAvoider}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={styles.title}>Каталог России</Text>
            <Text style={styles.subtitle}>
              {hasSourceSnapshot
                ? `В библиотеке доступны ${sourceSnapshotCount} текстов.`
                : 'В каталоге доступны Конституция, основные кодексы и ключевые законы.'}
            </Text>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchLabel}>Найти в каталоге</Text>
            <TextInput
              accessibilityLabel="Поисковый запрос"
              accessibilityHint="Введите название, номер или тему документа"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch(query)}
              placeholder="Название, номер или тема"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            <View style={styles.quickFilters}>
              {quickFilters.map((filter) => (
                <Pressable
                  accessibilityRole="button"
                  key={filter.query}
                  onPress={() => setQuery(filter.query)}
                  style={({ pressed }) => [styles.quickFilter, pressed && styles.pressed]}
                >
                  <Text style={styles.quickFilterText}>{filter.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {notice ? <NoticeCard title="Статус каталога" message={notice} /> : null}

          <View style={styles.resultsHeading}>
            <View>
              <Text style={styles.resultsTitle}>
                {query.trim() ? 'Результаты поиска' : 'Все документы'}
              </Text>
              <Text style={styles.resultsHint}>
                {query.trim()
                  ? `По запросу «${query.trim()}»`
                  : hasSourceSnapshot
                    ? 'Конституция, кодексы и ключевые законы'
                    : 'Локальные реквизиты: Конституция, кодексы и ключевые законы'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void runSearch(query)}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            >
              <Text style={styles.refreshText}>Обновить</Text>
            </Pressable>
          </View>

          {isLoading ? <LoadingBlock label="Ищем в каталоге…" /> : null}
          {!isLoading && documents.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              message="Попробуйте название, номер (например, «152-ФЗ») или слова «кодексы», «федеральные законы»."
            />
          ) : null}
          {!isLoading ? (
            <View style={styles.cards}>
              {documents.map((document) => (
                <DocumentCard document={document} key={document.id} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const quickFilters = [
  { label: 'Конституция', query: 'конституция' },
  { label: 'Все кодексы', query: 'кодексы' },
  { label: 'Федеральные законы', query: 'федеральные законы' },
];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoider: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  intro: { gap: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  searchBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  searchLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quickFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  quickFilter: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  quickFilterText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  resultsHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  resultsTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  resultsHint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  refreshButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  refreshText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  cards: { gap: spacing.sm },
  pressed: { opacity: 0.65 },
});
