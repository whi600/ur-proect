import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  listOfflineCatalogDocuments,
  makeOfflineCatalogFtsQuery,
  openImportedSourceSnapshot,
  searchOfflineCatalogDocuments,
  type OfflineCatalogDocument,
  type OfflineCatalogFragment,
} from './offlineCatalogDb';
import type { DocumentDetail, DocumentFragment, DocumentSummary } from '../types/legal';

const INITIAL_FRAGMENT_PAGE_SIZE = 24;
const MAX_FRAGMENT_PAGE_SIZE = 48;
const MAX_SEARCH_RESULTS = 80;

export const isNativeSourceSnapshotSupported = Platform.OS !== 'web';
export const SOURCE_SNAPSHOT_WEB_PAGE_COUNT = 0;

export async function downloadAllSourceSnapshotPages(
  _onProgress: (done: number, total: number) => void,
): Promise<void> {
  throw new Error('В нативном приложении тексты уже включены в локальный пакет.');
}

export type SourceSnapshotFragmentPage = {
  fragments: DocumentFragment[];
  total: number;
};

function normalise(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
}

function queryTokens(query: string): string[] {
  return (
    normalise(query)
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 8) ?? []
  );
}

function pageLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return INITIAL_FRAGMENT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(Math.floor(value), MAX_FRAGMENT_PAGE_SIZE));
}

function toSummary(document: OfflineCatalogDocument): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    document_type: document.document_type,
    source_name: document.source_name,
    source_url: document.source_url,
    document_number: document.document_number,
    published_at: document.published_at,
    revision_label: document.revision_label,
    effective_from: document.effective_from,
    effective_to: document.effective_to,
    is_demo: document.is_demo === 1,
    jurisdiction: document.jurisdiction,
    legal_level: document.legal_level,
    content_state: document.content_state,
    source_checked_at: document.source_checked_at,
  };
}

function toFragment(fragment: OfflineCatalogFragment): DocumentFragment {
  return {
    id: fragment.id,
    ordinal: fragment.ordinal,
    kind: fragment.fragment_kind,
    label: fragment.article_label,
    heading: fragment.heading,
    body: fragment.body,
    legal_status: fragment.legal_status ?? null,
    revision_label: fragment.revision_label,
    valid_from: fragment.valid_from,
    valid_to: fragment.valid_to,
  };
}

function sourceSnapshotSummary(document: OfflineCatalogDocument): string {
  const count = document.article_count ?? 0;
  return [
    'Текст доступен без сети как снимок стороннего открытого источника.',
    `В снимке заявлено статей: ${count}.`,
    'Статус: не прошёл юридическую проверку в «ПравоОрбите»; перед использованием сверяйте официальную публикацию и редакцию на нужную дату.',
  ].join('\n\n');
}

async function sourceDatabase(): Promise<SQLiteDatabase> {
  if (!isNativeSourceSnapshotSupported) {
    throw new Error('Полнотекстовой офлайн-снимок доступен только в нативном приложении.');
  }
  return openImportedSourceSnapshot();
}

/** Returns source-snapshot cards stored in the native app bundle. */
export async function listSourceSnapshotDocuments(): Promise<DocumentSummary[]> {
  const database = await sourceDatabase();
  const documents = await listOfflineCatalogDocuments(database, { limit: MAX_SEARCH_RESULTS });
  return documents.map(toSummary);
}

/**
 * Finds a document by title/number/category and also searches its bundled
 * fragments with FTS5. No request is made to a network service.
 */
export async function searchSourceSnapshotDocuments(query: string): Promise<DocumentSummary[]> {
  const database = await sourceDatabase();
  const tokens = queryTokens(query);
  const allDocuments = await listOfflineCatalogDocuments(database, { limit: MAX_SEARCH_RESULTS });

  if (tokens.length === 0) {
    return allDocuments.map(toSummary);
  }

  const metadataMatches = allDocuments.filter((document) => {
    const haystack = normalise(
      [
        document.title,
        document.document_type,
        document.document_number ?? '',
        document.category,
        document.search_terms,
      ].join(' '),
    );
    return tokens.every((token) => haystack.includes(token));
  });

  const ftsQuery = makeOfflineCatalogFtsQuery(query);
  const textMatches = ftsQuery
    ? await searchOfflineCatalogDocuments(database, query, MAX_SEARCH_RESULTS)
    : [];

  const byId = new Map<string, OfflineCatalogDocument>();
  for (const document of [...metadataMatches, ...textMatches]) {
    byId.set(document.id, document);
  }

  return [...byId.values()].slice(0, MAX_SEARCH_RESULTS).map(toSummary);
}

async function fragmentPage(
  database: SQLiteDatabase,
  id: string,
  offset: number,
  limit: number,
): Promise<SourceSnapshotFragmentPage> {
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = pageLimit(limit);
  const totalRow = await database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM fragments WHERE document_id = ?',
    [id],
  );
  const fragments = await database.getAllAsync<OfflineCatalogFragment>(
    'SELECT * FROM fragments WHERE document_id = ? ORDER BY ordinal LIMIT ? OFFSET ?',
    [id, safeLimit, safeOffset],
  );
  return { fragments: fragments.map(toFragment), total: totalRow?.total ?? 0 };
}

/** Opens the first page of a source-snapshot text without loading an entire code into memory. */
export async function loadSourceSnapshotDocument(id: string): Promise<DocumentDetail | undefined> {
  const database = await sourceDatabase();
  const document = await database.getFirstAsync<OfflineCatalogDocument>(
    'SELECT * FROM documents WHERE id = ?',
    [id],
  );
  if (!document) {
    return undefined;
  }

  // Fetch the first page only to keep large codes responsive on a phone.
  const page = await fragmentPage(database, id, 0, INITIAL_FRAGMENT_PAGE_SIZE);
  return {
    ...toSummary(document),
    content: sourceSnapshotSummary(document),
    fragments: page.fragments,
    fragments_total: page.total,
  };
}

/** Loads the next visible page of text for the document reader. */
export async function loadSourceSnapshotFragmentPage(
  id: string,
  offset: number,
): Promise<SourceSnapshotFragmentPage | undefined> {
  const database = await sourceDatabase();
  const exists = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM documents WHERE id = ?',
    [id],
  );
  if (!exists) {
    return undefined;
  }
  return fragmentPage(database, id, offset, INITIAL_FRAGMENT_PAGE_SIZE);
}
