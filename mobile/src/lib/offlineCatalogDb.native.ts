import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Native integration point for the bundled SQLite asset.
 *
 * Wrap the native Expo Router layout with:
 *   <SQLite.SQLiteProvider {...offlineCatalogProviderConfig}>…</SQLite.SQLiteProvider>
 *
 * The provider imports the versioned file once into the app's private storage.
 * Do not use forceOverwrite for ordinary launches: a future data migration must
 * decide how to preserve saved items and downloaded verified packages.
 */
export const OFFLINE_CATALOG_DATABASE_NAME = 'ru-core-catalog-v1.db';
const bundledOfflineCatalogAsset = require('../../assets/legal/ru-core-catalog-v1.db');

export const offlineCatalogProviderConfig = {
  databaseName: OFFLINE_CATALOG_DATABASE_NAME,
  assetSource: { assetId: bundledOfflineCatalogAsset },
} as const;

/**
 * A separate, versioned package with legal-text fragments from a third-party
 * source snapshot. It is intentionally not a replacement for the small,
 * metadata-only catalogue above: the UI must keep its `source_snapshot` state
 * visible until every document/editorial date has passed legal review.
 */
export const SOURCE_SNAPSHOT_DATABASE_NAME = 'ru-core-snapshot-2026-09-25.db';
const bundledSourceSnapshotAsset = require('../../assets/legal/ru-core-snapshot-2026-09-25.db');

export const sourceSnapshotProviderConfig = {
  databaseName: SOURCE_SNAPSHOT_DATABASE_NAME,
  assetSource: { assetId: bundledSourceSnapshotAsset },
} as const;

export type OfflineCatalogPackageMeta = {
  packageId: string;
  packageVersion: string;
  schemaVersion: number;
  builtAt: string;
  contentScope: 'metadata_only' | 'source_snapshot' | 'verified_text';
  legalTextIncluded: boolean;
  sourceManifestHash: string;
  notice: string;
};

export type OfflineCatalogDocument = {
  id: string;
  catalog_parent_id?: string | null;
  source_snapshot_id?: string;
  upstream_slug?: string;
  title: string;
  document_type: string;
  document_number: string | null;
  source_name: string;
  source_url: string | null;
  claimed_official_source_url?: string | null;
  published_at: string | null;
  revision_label: string;
  effective_from: string | null;
  effective_to: string | null;
  source_checked_at: string | null;
  content_hash: string;
  source_digest?: string;
  content_state:
    'offline_metadata' | 'source_metadata' | 'planned' | 'source_snapshot' | 'verified_text';
  content_notice: string;
  is_demo: 0 | 1;
  jurisdiction: string | null;
  legal_level: string | null;
  category: string;
  search_terms: string;
  text_package_version: string | null;
  article_count?: number;
  inserted_at: string;
};

export type OfflineCatalogFragment = {
  id: number;
  document_id: string;
  ordinal: number;
  fragment_kind:
    'metadata' | 'preamble' | 'section' | 'chapter' | 'article' | 'paragraph' | 'appendix';
  article_label: string | null;
  heading: string;
  body: string;
  text_status: 'metadata_only' | 'source_snapshot' | 'verified_text';
  legal_status?: string | null;
  source_fragment_ref: string | null;
  source_file?: string;
  source_sha256?: string;
  structure_path?: string;
  revision_label: string | null;
  valid_from: string | null;
  valid_to: string | null;
  verified_at: string | null;
  content_hash: string;
};

export type OfflineCatalogSearchHit = OfflineCatalogDocument & {
  fragment_id: number;
  matched_heading: string;
  excerpt: string;
  rank: number;
};

function ensureNativeRuntime(): void {
  if (Platform.OS === 'web') {
    throw new Error(
      'Веб-версия не загружает SQLite-asset. Для проверки офлайн-пакета используйте Expo Go на iPhone или будущую нативную сборку.',
    );
  }
}

function positiveLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.floor(value), 100));
}

/**
 * Convert free-form user input into a conservative FTS5 prefix query.
 * Parameters are still bound by SQLite; this step only avoids FTS syntax being
 * interpreted as part of a user's search phrase.
 */
export function makeOfflineCatalogFtsQuery(query: string): string | null {
  const tokens = (
    query
      .normalize('NFKC')
      .toLocaleLowerCase('ru-RU')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .filter((token) => token.length > 0)
    .slice(0, 8);

  if (tokens.length === 0) {
    return null;
  }

  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' AND ');
}

/**
 * Call only below SQLiteProvider. Calling openDatabaseAsync before the provider
 * imports the asset would create an empty database with the same name.
 */
export async function openImportedOfflineCatalog(): Promise<SQLiteDatabase> {
  ensureNativeRuntime();
  return SQLite.openDatabaseAsync(OFFLINE_CATALOG_DATABASE_NAME);
}

/**
 * Call only below the native SQLiteProvider configured with
 * `sourceSnapshotProviderConfig`. The versioned name prevents a package update
 * from silently overwriting an older local database.
 */
export async function openImportedSourceSnapshot(): Promise<SQLiteDatabase> {
  ensureNativeRuntime();
  return SQLite.openDatabaseAsync(SOURCE_SNAPSHOT_DATABASE_NAME);
}

export async function getOfflineCatalogPackageMeta(
  database: SQLiteDatabase,
): Promise<OfflineCatalogPackageMeta> {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM catalog_meta',
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    packageId: values.get('package_id') ?? 'unknown',
    packageVersion: values.get('package_version') ?? 'unknown',
    schemaVersion: Number(values.get('schema_version') ?? 0),
    builtAt: values.get('built_at') ?? 'unknown',
    contentScope: (values.get('content_scope') ?? 'metadata_only') as
      'metadata_only' | 'source_snapshot' | 'verified_text',
    legalTextIncluded: values.get('legal_text_included') === 'true',
    sourceManifestHash: values.get('source_manifest_hash') ?? '',
    notice: values.get('notice') ?? '',
  };
}

export async function listOfflineCatalogDocuments(
  database: SQLiteDatabase,
  options: { category?: string; limit?: number } = {},
): Promise<OfflineCatalogDocument[]> {
  const limit = positiveLimit(options.limit ?? 100, 100);
  if (options.category) {
    return database.getAllAsync<OfflineCatalogDocument>(
      'SELECT * FROM documents WHERE category = ? ORDER BY title COLLATE NOCASE LIMIT ?',
      [options.category, limit],
    );
  }
  return database.getAllAsync<OfflineCatalogDocument>(
    'SELECT * FROM documents ORDER BY category, title COLLATE NOCASE LIMIT ?',
    [limit],
  );
}

export async function getOfflineCatalogDocument(
  database: SQLiteDatabase,
  id: string,
): Promise<{ document: OfflineCatalogDocument; fragments: OfflineCatalogFragment[] } | null> {
  const document = await database.getFirstAsync<OfflineCatalogDocument>(
    'SELECT * FROM documents WHERE id = ?',
    [id],
  );
  if (!document) {
    return null;
  }
  const fragments = await database.getAllAsync<OfflineCatalogFragment>(
    'SELECT * FROM fragments WHERE document_id = ? ORDER BY ordinal',
    [id],
  );
  return { document, fragments };
}

export async function searchOfflineCatalogDocuments(
  database: SQLiteDatabase,
  query: string,
  limit = 20,
): Promise<OfflineCatalogSearchHit[]> {
  const ftsQuery = makeOfflineCatalogFtsQuery(query);
  if (!ftsQuery) {
    return [];
  }

  return database.getAllAsync<OfflineCatalogSearchHit>(
    `
      SELECT
        documents.*,
        fragments.id AS fragment_id,
        fragments.heading AS matched_heading,
        snippet(fragment_fts, 2, '‹', '›', '…', 14) AS excerpt,
        bm25(fragment_fts) AS rank
      FROM fragment_fts
      JOIN fragments ON fragments.id = fragment_fts.rowid
      JOIN documents ON documents.id = fragments.document_id
      WHERE fragment_fts MATCH ?
      ORDER BY rank, documents.title COLLATE NOCASE
      LIMIT ?
    `,
    [ftsQuery, positiveLimit(limit, 20)],
  );
}
