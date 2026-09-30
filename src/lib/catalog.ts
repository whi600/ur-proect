import rawCatalog from '../data/catalog.json';
import {
  listSourceSnapshotDocuments,
  loadSourceSnapshotDocument,
  loadSourceSnapshotFragmentPage,
} from './texts';
import type { DocumentDetail, DocumentSummary } from '../types/legal';

type CatalogCard = DocumentSummary & {
  search_terms?: string;
  category?: string;
  content_notice?: string;
};

const metadata = rawCatalog.documents.map((item): CatalogCard => ({
  id: item.id,
  title: item.title,
  document_type: item.document_type,
  source_name: item.source_name,
  source_url: null,
  document_number: item.document_number,
  published_at: null,
  revision_label: item.revision_label,
  effective_from: null,
  effective_to: null,
  is_demo: false,
  jurisdiction: item.jurisdiction,
  legal_level: item.legal_level,
  content_state: 'offline_metadata',
  source_checked_at: null,
  search_terms: item.search_terms,
  category: item.category,
  content_notice: item.content_notice,
}));

const metadataById = new Map(metadata.map((document) => [document.id, document]));

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
}

export async function listDocuments(): Promise<CatalogCard[]> {
  const merged = new Map<string, CatalogCard>(metadata.map((document) => [document.id, document]));
  for (const snapshot of await listSourceSnapshotDocuments()) {
    const card = metadataById.get(snapshot.id);
    merged.set(snapshot.id, { ...card, ...snapshot, search_terms: card?.search_terms });
  }
  return [...merged.values()].sort((left, right) => {
    const rank = (item: CatalogCard) =>
      item.document_type === 'Конституция' ? 0 : item.document_type === 'Кодекс' ? 1 : 2;
    return rank(left) - rank(right) || left.title.localeCompare(right.title, 'ru');
  });
}

export function filterDocuments(documents: CatalogCard[], query: string): CatalogCard[] {
  const tokens: string[] = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!tokens.length) return documents;
  if (tokens.some((token) => token === 'кодекс' || token === 'кодексы')) {
    return documents.filter((document) => document.document_type === 'Кодекс');
  }
  if (tokens.includes('федеральные') && tokens.includes('законы')) {
    return documents.filter((document) => document.document_type === 'Федеральный закон');
  }
  return documents.filter((document) => {
    const haystack = normalize(
      [
        document.title,
        document.document_number ?? '',
        document.document_type,
        document.category ?? '',
        document.search_terms ?? '',
      ].join(' '),
    );
    return tokens.every((token) => haystack.includes(token));
  });
}

export async function getDocument(id: string, offset = 0): Promise<DocumentDetail | undefined> {
  const snapshot = await loadSourceSnapshotDocument(id, offset);
  if (snapshot) return snapshot;
  const card = metadataById.get(id);
  if (!card) return undefined;
  return {
    ...card,
    content: card.content_notice ?? 'В каталоге пока есть только реквизиты этого документа.',
  };
}

export { loadSourceSnapshotFragmentPage };
