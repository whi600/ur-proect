import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { NoticeCard } from '../../src/components/Ui';
import { getOfflineCatalog } from '../../src/data/offlineCatalog';
import { checkApi, loadDocuments, type ApiStatus } from '../../src/lib/api';
import {
  downloadAllSourceSnapshotPages,
  SOURCE_SNAPSHOT_WEB_PAGE_COUNT,
} from '../../src/lib/sourceSnapshotCatalog';
import { colors, radius, spacing } from '../../src/theme';
import type { DocumentSummary } from '../../src/types/legal';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    kind: 'not-configured',
    message: 'Проверяем локальную конфигурацию…',
  });
  const [documents, setDocuments] = useState<DocumentSummary[]>(getOfflineCatalog);
  const [notice, setNotice] = useState<string>();
  const [refreshing, setRefreshing] = useState(true);
  const [downloadingTexts, setDownloadingTexts] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>();

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [status, result] = await Promise.all([checkApi(), loadDocuments()]);
    setApiStatus(status);
    setDocuments(result.data);
    setNotice(result.notice);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([checkApi(), loadDocuments()]).then(([status, result]) => {
      if (!active) {
        return;
      }
      setApiStatus(status);
      setDocuments(result.data);
      setNotice(result.notice);
      setRefreshing(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const openSearch = () => {
    router.push({ pathname: '/search', params: { q: query.trim() } });
  };
  const downloadTexts = async () => {
    setDownloadingTexts(true);
    setDownloadProgress('Подготовка офлайн-библиотеки…');
    try {
      await downloadAllSourceSnapshotPages((done, total) => {
        if (done % 12 === 0 || done === total) {
          setDownloadProgress(`Сохранено ${done} из ${total} частей текста`);
        }
      });
      setDownloadProgress('Все тексты сохранены для чтения без сети на этом устройстве.');
    } catch (error) {
      setDownloadProgress(
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить библиотеку. Повторите позже.',
      );
    } finally {
      setDownloadingTexts(false);
    }
  };
  const codeCount = documents.filter((document) => document.legal_level === 'code').length;
  const lawCount = documents.filter(
    (document) => document.legal_level === 'federal_law' || document.legal_level === 'law',
  ).length;
  const sourceSnapshotCount = documents.filter(
    (document) => document.content_state === 'source_snapshot',
  ).length;
  const hasSourceSnapshot = sourceSnapshotCount > 0;
  const offlineLabel = hasSourceSnapshot
    ? `Библиотека: ${sourceSnapshotCount} текстов`
    : 'Каталог документов';
  const connection =
    apiStatus.kind === 'online'
      ? {
          color: colors.success,
          background: colors.successBackground,
          label: `${offlineLabel} · API доступен`,
        }
      : apiStatus.kind === 'unavailable'
        ? {
            color: colors.warning,
            background: colors.warningBackground,
            label: `${offlineLabel} · API сейчас недоступен`,
          }
        : {
            color: colors.primary,
            background: colors.primarySoft,
            label: offlineLabel,
          };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
          }
        >
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <Text style={styles.eyebrow}>ПРАВООРБИТА</Text>
              <Text style={styles.demoLabel}>КАТАЛОГ ДОКУМЕНТОВ</Text>
            </View>
            <Text style={styles.title}>Найдите нужный документ</Text>
            <Text style={styles.subtitle}>
              {hasSourceSnapshot
                ? 'Конституция, основные кодексы и ключевые законы собраны в библиотеке приложения.'
                : 'Конституция, основные кодексы и ключевые законы собраны в каталоге приложения.'}
            </Text>

            <View style={styles.searchPanel}>
              <Text style={styles.searchLabel}>Поиск документов</Text>
              <View style={styles.searchRow}>
                <TextInput
                  accessibilityLabel="Найти документ"
                  accessibilityHint="Введите название, номер или тему документа"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  onSubmitEditing={openSearch}
                  placeholder="Название, номер или тема"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={query}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={openSearch}
                  style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
                >
                  <Text style={styles.searchButtonText}>Найти</Text>
                </Pressable>
              </View>
              <Text style={styles.searchHint}>
                Можно искать с пустым полем — откроется весь каталог.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Основные документы</Text>
              <Text style={styles.sectionHint}>
                Конституция · {codeCount} кодексов · {lawCount} ключевых законов
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/search')}
              style={({ pressed }) => [styles.catalogLink, pressed && styles.pressed]}
            >
              <Text style={styles.catalogLinkText}>Весь каталог →</Text>
            </Pressable>
          </View>

          <View style={styles.catalogCards}>
            {catalogItems(hasSourceSnapshot, Platform.OS === 'web').map((item) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Открыть раздел: ${item.title}`}
                key={item.title}
                onPress={() => {
                  if (item.kind === 'document') {
                    router.push({ pathname: '/document/[id]', params: { id: item.documentId } });
                    return;
                  }
                  router.push({ pathname: '/search', params: { q: item.query } });
                }}
                style={({ pressed }) => [styles.catalogCard, pressed && styles.pressed]}
              >
                <View style={styles.catalogNumber}>
                  <Text style={styles.catalogNumberText}>{item.number}</Text>
                </View>
                <View style={styles.catalogCardBody}>
                  <Text style={styles.catalogCardTitle}>{item.title}</Text>
                  <Text style={styles.catalogCardText}>{item.description}</Text>
                </View>
                <Text style={styles.catalogArrow}>→</Text>
              </Pressable>
            ))}
          </View>

          {Platform.OS === 'web' && hasSourceSnapshot ? (
            <View style={styles.offlineCard}>
              <Text style={styles.offlineTitle}>Тексты без интернета</Text>
              <Text style={styles.offlineText}>
                Каталог открывается сразу. Статьи загружаются частями при чтении. Для доступа ко
                всем текстам без сети сохраните библиотеку отдельно (около 55 МБ,
                {` ${SOURCE_SNAPSHOT_WEB_PAGE_COUNT}`} частей).
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={downloadingTexts}
                onPress={() => void downloadTexts()}
                style={({ pressed }) => [styles.offlineButton, pressed && styles.pressed]}
              >
                <Text style={styles.offlineButtonText}>
                  {downloadingTexts ? 'Сохраняем…' : 'Сохранить тексты для офлайн'}
                </Text>
              </Pressable>
              {downloadProgress ? <Text style={styles.offlineText}>{downloadProgress}</Text> : null}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Открыть ИИ-помощника"
            onPress={() => router.push('/assistant')}
            style={({ pressed }) => [styles.assistantCard, pressed && styles.pressed]}
          >
            <View style={styles.assistantTopline}>
              <Text style={styles.assistantKicker}>ИИ-ПОМОЩНИК</Text>
              <Text style={styles.assistantArrow}>→</Text>
            </View>
            <Text style={styles.assistantTitle}>Не знаете, с чего начать?</Text>
            <Text style={styles.assistantText}>
              Задайте вопрос по документам и получите учебный ответ.
            </Text>
            <Text style={styles.assistantLink}>Открыть помощника</Text>
          </Pressable>

          <View
            accessibilityLabel={connection.label}
            style={[styles.statusRow, { borderLeftColor: connection.color }]}
          >
            <View style={[styles.statusDot, { backgroundColor: connection.color }]} />
            <Text style={[styles.statusText, { color: connection.color }]}>{connection.label}</Text>
          </View>

          {notice ? <NoticeCard title="Статус библиотеки" message={notice} /> : null}

          <NoticeCard
            tone="info"
            title="Что хранится на устройстве"
            message={
              hasSourceSnapshot
                ? Platform.OS === 'web'
                  ? `В библиотеке доступны ${sourceSnapshotCount} текстов. Для чтения без сети сохраните их кнопкой выше; браузер может удалить офлайн-данные при нехватке памяти.`
                  : `В библиотеке доступны ${sourceSnapshotCount} текстов. Реквизиты и источник указаны в карточке каждого документа.`
                : 'В каталоге доступны реквизиты основных актов.'
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type CatalogItem =
  | {
      number: string;
      title: string;
      description: string;
      kind: 'document';
      documentId: string;
    }
  | {
      number: string;
      title: string;
      description: string;
      kind: 'search';
      query: string;
    };

function catalogItems(hasSourceSnapshot: boolean, isWeb: boolean): CatalogItem[] {
  return [
    {
      number: '01',
      title: 'Конституция РФ',
      description: hasSourceSnapshot
        ? isWeb
          ? 'Основной закон: текст загружается частями и может быть сохранён для офлайн.'
          : 'Основной закон: текст доступен локально, без подключения к сети.'
        : 'Основной закон: локально сохранены реквизиты; текст откроется в нативном пакете.',
      kind: 'document',
      documentId: 'ru-constitution-source',
    },
    {
      number: '02',
      title: 'Все кодексы',
      description: 'Гражданский, уголовный, трудовой, налоговый и другие основные кодексы.',
      kind: 'search',
      query: 'кодексы',
    },
    {
      number: '03',
      title: 'Федеральные законы',
      description: 'Ключевые акты об обращениях, данных, недвижимости, образовании и не только.',
      kind: 'search',
      query: 'федеральные законы',
    },
  ];
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoider: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  demoLabel: {
    backgroundColor: colors.demoBackground,
    borderColor: colors.assistantBorder,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.assistantDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', lineHeight: 34 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  searchPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  searchLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
  },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  searchInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.controlBorder,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  searchButtonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  searchHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: spacing.xs,
  },
  statusRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: { borderRadius: 99, height: 6, width: 6 },
  statusText: { fontSize: 12, fontWeight: '800' },
  sectionHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sectionHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  catalogLink: { paddingBottom: spacing.sm, paddingLeft: spacing.sm, paddingTop: spacing.sm },
  catalogLinkText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  catalogCards: { gap: spacing.sm },
  catalogCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  catalogNumber: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 28,
  },
  catalogNumberText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  catalogCardBody: { flex: 1, gap: 2 },
  catalogCardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  catalogCardText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  catalogArrow: { color: colors.primary, fontSize: 22, fontWeight: '500' },
  offlineCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  offlineTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  offlineText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  offlineButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  offlineButtonText: { color: colors.surface, fontSize: 14, fontWeight: '800' },
  assistantCard: {
    backgroundColor: colors.surface,
    borderColor: colors.assistantBorder,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftColor: colors.assistant,
    borderLeftWidth: 3,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  assistantTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  assistantKicker: {
    color: colors.assistantDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.65,
  },
  assistantArrow: { color: colors.assistantDark, fontSize: 22 },
  assistantTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  assistantText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  assistantLink: {
    color: colors.assistantDark,
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  pressed: { opacity: 0.72 },
});
