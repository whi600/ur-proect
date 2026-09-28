import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ContentStateBadge,
  EmptyState,
  FavoriteButton,
  LoadingBlock,
  NoticeCard,
} from '../../src/components/Ui';
import { loadDocument, loadMoreDocumentFragments } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';
import type { DocumentDetail, DocumentFragment } from '../../src/types/legal';

function dateLabel(value: string | null): string {
  return value ?? 'не указана';
}

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const documentId = Array.isArray(id) ? id[0] : id;
  const [document, setDocument] = useState<DocumentDetail>();
  const [notice, setNotice] = useState<string>();
  const [isLoading, setIsLoading] = useState(Boolean(documentId));
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const openSource = async () => {
    if (!document?.source_url) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(document.source_url);
      if (!supported) {
        setNotice(
          document.content_state === 'source_snapshot'
            ? 'Не удалось открыть источник этого локального текста на этом устройстве.'
            : 'Не удалось открыть адрес источника на этом устройстве.',
        );
        return;
      }
      await Linking.openURL(document.source_url);
    } catch {
      setNotice('Не удалось открыть источник. Проверьте подключение к интернету.');
    }
  };

  const reload = useCallback(async () => {
    if (!documentId) {
      setDocument(undefined);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setIsLoadingMore(false);
    const result = await loadDocument(documentId);
    setDocument(result.data);
    setNotice(result.notice);
    setIsLoading(false);
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      return;
    }
    let active = true;
    void loadDocument(documentId).then((result) => {
      if (!active) {
        return;
      }
      setDocument(result.data);
      setNotice(result.notice);
      setIsLoadingMore(false);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [documentId]);

  const loadMore = useCallback(async () => {
    if (
      !documentId ||
      !document?.fragments ||
      !document.fragments_total ||
      document.fragments.length >= document.fragments_total ||
      isLoadingMore
    ) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const page = await loadMoreDocumentFragments(documentId, document.fragments.length);
      if (!page) {
        return;
      }
      setDocument((current) => {
        if (!current || current.id !== documentId) {
          return current;
        }
        const knownIds = new Set((current.fragments ?? []).map((fragment) => fragment.id));
        const appended = page.fragments.filter((fragment) => !knownIds.has(fragment.id));
        return {
          ...current,
          fragments: [...(current.fragments ?? []), ...appended],
          fragments_total: page.total,
        };
      });
    } catch {
      setNotice('Не удалось загрузить следующую часть текста. Попробуйте ещё раз.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [document, documentId, isLoadingMore]);

  const sourceLinkLabel = 'Открыть источник ↗';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <Stack.Screen options={{ title: document?.title ?? 'Документ' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? <LoadingBlock label="Открываем документ…" /> : null}
        {notice ? <NoticeCard title="Статус данных" message={notice} /> : null}
        {!isLoading && !document ? (
          <EmptyState
            title="Документ не найден"
            message="Эта карточка отсутствует в локальном каталоге. Вернитесь к поиску и выберите другой документ."
          />
        ) : null}
        {document ? (
          <>
            <View style={styles.headerCard}>
              <View style={styles.headerTopline}>
                <Text style={styles.type}>{document.document_type}</Text>
                <ContentStateBadge state={document.content_state} />
              </View>
              <Text style={styles.title}>{document.title}</Text>
              <Text style={styles.revision}>{document.revision_label}</Text>
              <FavoriteButton documentId={document.id} />
            </View>

            <View style={styles.metaCard}>
              <MetaRow label="Источник" value={document.source_name} />
              <MetaRow label="Номер" value={document.document_number ?? 'не указан'} />
              <MetaRow label="Дата акта" value={dateLabel(document.published_at)} />
              <MetaRow label="Действует с" value={dateLabel(document.effective_from)} />
              <MetaRow label="Действует до" value={dateLabel(document.effective_to)} />
              {document.jurisdiction ? (
                <MetaRow label="Юрисдикция" value={document.jurisdiction} />
              ) : null}
              {document.source_checked_at ? (
                <MetaRow label="Источник проверен" value={document.source_checked_at} />
              ) : null}
            </View>

            <DocumentStateNotice contentState={document.content_state} />

            {document.source_url ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openSource()}
                style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}
              >
                <Text style={styles.sourceLinkText}>{sourceLinkLabel}</Text>
              </Pressable>
            ) : null}

            {document.content_state !== 'source_snapshot' ? (
              <View style={styles.contentCard}>
                <Text style={styles.contentHeading}>{contentHeading(document.content_state)}</Text>
                <Text style={styles.documentContent}>{document.content}</Text>
              </View>
            ) : null}

            {document.fragments?.length ? (
              <View style={styles.fragmentsSection}>
                <View style={styles.fragmentsHeadingRow}>
                  <View style={styles.fragmentsHeadingCopy}>
                    <Text style={styles.contentHeading}>Текст фрагментов</Text>
                    <Text style={styles.fragmentsHint}>
                      Показано {document.fragments.length} из{' '}
                      {document.fragments_total ?? document.fragments.length}
                    </Text>
                  </View>
                </View>
                {document.fragments.map((fragment) => (
                  <FragmentCard fragment={fragment} key={fragment.id} />
                ))}
                {(document.fragments_total ?? 0) > document.fragments.length ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isLoadingMore}
                    onPress={() => void loadMore()}
                    style={({ pressed }) => [
                      styles.moreButton,
                      (pressed || isLoadingMore) && styles.pressed,
                    ]}
                  >
                    <Text style={styles.moreButtonText}>
                      {isLoadingMore ? 'Загружаем…' : 'Показать следующие статьи'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => void reload()}
              style={({ pressed }) => [styles.reload, pressed && styles.pressed]}
            >
              <Text style={styles.reloadText}>Обновить карточку</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentStateNotice({ contentState }: { contentState: DocumentDetail['content_state'] }) {
  if (contentState === 'offline_metadata') {
    return (
      <NoticeCard
        tone="info"
        title="Реквизиты документа"
        message="На устройстве сохранена только карточка реквизитов. Полный текст, статьи, история изменений и подтверждённая редакция документа в эту версию не включены."
      />
    );
  }

  if (contentState === 'source_metadata') {
    return (
      <NoticeCard
        tone="info"
        title="Текст в приложении не загружен"
        message="Это карточка официального источника, а не локальная копия закона. Перед применением откройте источник и проверьте редакцию на нужную дату."
      />
    );
  }

  if (contentState === 'planned') {
    return (
      <NoticeCard
        title="Раздел готовится"
        message="Федеральные законы будут добавляться по одному после проверки официальной публикации, редакции и периода действия."
      />
    );
  }

  if (contentState === 'source_snapshot') {
    return null;
  }

  if (contentState === 'verified_text') {
    return (
      <NoticeCard
        tone="info"
        title="Проверенный текст"
        message="Перед юридическим использованием всё равно проверяйте дату редакции и официальный источник."
      />
    );
  }

  return (
    <NoticeCard
      tone="info"
      title="Учебный материал"
      message="Эта карточка создана для тестирования интерфейса. Не используйте её для правовых выводов."
    />
  );
}

function contentHeading(contentState: DocumentDetail['content_state']): string {
  if (contentState === 'offline_metadata') {
    return 'Карточка реквизитов';
  }
  if (contentState === 'source_metadata') {
    return 'Пояснение к источнику';
  }
  if (contentState === 'source_snapshot') {
    return 'Текст документа';
  }
  if (contentState === 'planned') {
    return 'Состояние раздела';
  }
  return contentState === 'demo' ? 'Текст учебной карточки' : 'Текст документа';
}

function FragmentCard({ fragment }: { fragment: DocumentFragment }) {
  const title = fragment.label ?? fragment.heading;
  const hasSeparateHeading = fragment.label && fragment.heading !== fragment.label;

  return (
    <View style={styles.fragmentCard}>
      <View style={styles.fragmentTopline}>
        <Text style={styles.fragmentLabel}>{title}</Text>
        {fragment.legal_status ? (
          <Text style={styles.fragmentStatus}>{fragment.legal_status}</Text>
        ) : null}
      </View>
      {hasSeparateHeading ? <Text style={styles.fragmentHeading}>{fragment.heading}</Text> : null}
      <Text selectable style={styles.fragmentBody}>
        {fragment.body}
      </Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  headerTopline: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  type: { color: colors.primaryDark, flex: 1, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 33 },
  revision: { color: colors.textMuted, fontSize: 14 },
  metaCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  metaRow: { gap: 2 },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaValue: { color: colors.text, fontSize: 15, lineHeight: 21 },
  contentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  contentHeading: { color: colors.text, fontSize: 17, fontWeight: '800' },
  documentContent: { color: colors.text, fontSize: 16, lineHeight: 25 },
  fragmentsSection: { gap: spacing.sm },
  fragmentsHeadingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fragmentsHeadingCopy: { gap: 2 },
  fragmentsHint: { color: colors.textMuted, fontSize: 13 },
  fragmentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  fragmentTopline: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  fragmentLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  fragmentStatus: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  fragmentHeading: { color: colors.primaryDark, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  fragmentBody: { color: colors.text, fontSize: 16, lineHeight: 25 },
  moreButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md,
  },
  moreButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' },
  sourceLink: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md,
  },
  sourceLinkText: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' },
  reload: { alignItems: 'center', padding: spacing.md },
  reloadText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.65 },
});
