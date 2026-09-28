import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFavorites } from '../context/FavoritesContext';
import { colors, radius, spacing } from '../theme';
import type { DocumentContentState, DocumentSummary } from '../types/legal';

export function DemoBadge() {
  return (
    <View style={styles.demoBadge}>
      <Text style={styles.demoBadgeText}>ДЕМО</Text>
    </View>
  );
}

export function ContentStateBadge({ state }: { state: DocumentContentState }) {
  if (state === 'demo') {
    return <DemoBadge />;
  }

  if (state === 'source_snapshot') {
    return null;
  }

  const palette =
    state === 'offline_metadata'
      ? { color: colors.primaryDark, label: 'РЕКВИЗИТЫ' }
      : state === 'source_metadata'
        ? { color: colors.primaryDark, label: 'ИСТОЧНИК' }
        : state === 'planned'
          ? { color: colors.warning, label: 'ГОТОВИТСЯ' }
          : { color: colors.success, label: 'ПРОВЕРЕНО' };

  return (
    <View style={[styles.stateBadge, { borderColor: palette.color }]}>
      <Text style={[styles.stateBadgeText, { color: palette.color }]}>{palette.label}</Text>
    </View>
  );
}

export function LoadingBlock({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <View style={styles.loadingBlock} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function NoticeCard({
  title,
  message,
  tone = 'warning',
}: {
  title: string;
  message: string;
  tone?: 'warning' | 'error' | 'info';
}) {
  const palette =
    tone === 'error'
      ? { text: colors.danger }
      : tone === 'info'
        ? { text: colors.demo }
        : { text: colors.warning };

  return (
    <View style={[styles.notice, { borderLeftColor: palette.text }]}>
      <Text style={[styles.noticeTitle, { color: palette.text }]}>{title}</Text>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function FavoriteButton({ documentId }: { documentId: string }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const selected = isFavorite(documentId);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? 'Убрать из избранного' : 'Добавить в избранное'}
      onPress={() => void toggleFavorite(documentId)}
      style={({ pressed }) => [
        styles.favoriteButton,
        selected && styles.favoriteButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.favoriteButtonText, selected && styles.favoriteButtonTextSelected]}>
        {selected ? '★ В избранном' : '☆ В избранное'}
      </Text>
    </Pressable>
  );
}

export function DocumentCard({ document }: { document: DocumentSummary }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть: ${document.title}`}
      onPress={() => router.push({ pathname: '/document/[id]', params: { id: document.id } })}
      style={({ pressed }) => [styles.documentCard, pressed && styles.pressed]}
    >
      <View style={styles.documentCardTopline}>
        <View style={styles.documentTypeChip}>
          <Text style={styles.documentType}>{document.document_type}</Text>
        </View>
        <ContentStateBadge state={document.content_state} />
      </View>
      <Text numberOfLines={3} style={styles.documentTitle}>
        {document.title}
      </Text>
      <Text style={styles.documentMeta}>{document.revision_label}</Text>
      <View style={styles.documentCardFooter}>
        <Text numberOfLines={1} style={styles.documentSource}>
          {document.source_name}
        </Text>
        <Text style={styles.documentOpen}>Открыть →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.assistantBorder,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  demoBadgeText: {
    color: colors.demo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  stateBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  loadingBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  favoriteButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  favoriteButtonSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryDark,
  },
  favoriteButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  favoriteButtonTextSelected: {
    color: colors.primaryDark,
  },
  documentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  documentCardTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  documentTypeChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  documentType: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  documentTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  documentMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  documentSource: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
  },
  documentCardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  documentOpen: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
